import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2, RefreshCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuota } from "@/hooks/useQuota";
import QuotaMeter from "@/components/billing/QuotaMeter";
import UpgradeSheet from "@/components/billing/UpgradeSheet";

interface ParsedPlayer {
  name: string;
  team: "blue" | "orange";
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  damage?: number | null;
  is_mvp: boolean;
  mmr?: number | null;
  mmr_change?: number | null;
}

interface ParsedScoreboard {
  game_mode: "1v1" | "2v2" | "3v3" | "4v4" | "rumble_3v3" | "hoops_2v2" | "snowday_3v3" | "dropshot_3v3" | "heatseeker_2v2";
  game_type: "competitive" | "casual";
  result?: "win" | "loss";
  division_change?: "up" | "down" | "none";
  players: ParsedPlayer[];
}

interface ScoreboardUploaderProps {
  userRlName?: string | null;
  onParsed: (data: ParsedScoreboard, imageFile: File) => void;
}

const ScoreboardUploader = ({ userRlName, onParsed }: ScoreboardUploaderProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  // Cached parse input so a retry doesn't require re-selecting / re-uploading the photo
  const lastParseInput = useRef<{ base64: string; mimeType: string; file: File } | null>(null);
  // In-memory cache of (image SHA-256) → previously-successful parsed result.
  // Per-tab only, intentional: we want to short-circuit Gemini calls when the
  // user re-uploads the exact same image (deliberate retry, accidental
  // double-pick, "Use different photo" reverted back), without locking the
  // user into a cached result across reloads. Each cache hit saves one paid
  // edge function invocation against the Supabase quota.
  const parseCache = useRef<Map<string, ParsedScoreboard>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const quota = useQuota();

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        // Scoreboards are read by Gemini OCR, and the stat digits are tiny —
        // especially on an angled phone-photo of a TV. Aggressive downscaling
        // (1920px @ 0.82) blurred those digits enough that the camera path
        // routinely failed to parse while a full-res library upload of the
        // same board succeeded. Keep far more detail: cap at 2560px and use
        // quality 0.92. A scoreboard at this size is still well under 1 MB.
        const MAX = 2560;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const parseScoreboard = async (base64: string, mimeType: string, originalFile: File) => {
    // Cache so the user can retry without re-selecting the file
    lastParseInput.current = { base64, mimeType, file: originalFile };
    setParseError(null);

    // Hash the raw image bytes (strip the "data:image/...;base64," prefix so
    // identical pixels always hash the same regardless of mime). If we've
    // already parsed this exact image successfully in this tab, hand the
    // cached result back instead of paying for another Gemini call.
    const rawB64 = base64.split(",")[1] ?? base64;
    let imageHash: string | null = null;
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawB64));
      imageHash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // SubtleCrypto unavailable (very old browsers / non-https). Skip cache.
    }

    if (imageHash) {
      const hit = parseCache.current.get(imageHash);
      if (hit) {
        lastParseInput.current = null;
        onParsed(hit, originalFile);
        toast({
          title: "Restored parsed scoreboard",
          description: `Same image — using the saved result (no new parse charged).`,
        });
        return;
      }
    }

    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-scoreboard", {
        body: {
          image_base64: rawB64,
          user_rl_name: userRlName,
          mime_type: mimeType,
        },
      });

      if (error) throw error;
      if (data?.error === "quota_exceeded") {
        quota.refetch();
        setShowUpgradeSheet(true);
        return;
      }
      if (data.error) throw new Error(data.error);

      quota.refetch();
      // Success — drop the cached input AND remember the result by hash so
      // a re-upload of the same image hits the cache.
      lastParseInput.current = null;
      if (imageHash) parseCache.current.set(imageHash, data as ParsedScoreboard);
      onParsed(data, originalFile);
      toast({ title: "Scoreboard parsed!", description: `Found ${data.players.length} players in a ${data.game_mode} ${data.game_type} game.` });
    } catch (err: any) {
      const message = err.message || "Try again or enter stats manually.";
      setParseError(message);
      toast({
        title: "Failed to parse scoreboard",
        description: message,
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const retryParse = () => {
    const cached = lastParseInput.current;
    if (!cached) return;
    parseScoreboard(cached.base64, cached.mimeType, cached.file);
  };

  const readRaw = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const isHeic = (file: File) =>
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !isHeic(file)) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);

    // HEIC: Canvas can't decode it in Chrome — send raw to Gemini which supports it
    if (isHeic(file)) {
      try {
        const raw = await readRaw(file);
        setPreview(null); // no preview for HEIC in Chrome
        parseScoreboard(raw, "image/heic", file);
      } catch {
        toast({ title: "Failed to read image", description: "Please try again.", variant: "destructive" });
      }
      return;
    }

    // Standard images: send the original untouched unless it's genuinely
    // huge. A typical iOS camera JPEG is ~2–4 MB; recompressing those was
    // exactly what was blurring the stat digits and breaking the parse, so
    // only downscale when the file is big enough to risk Gemini's inline
    // payload limit (~5 MB after base64 inflation → ~6.5 MB).
    try {
      if (file.size > 5 * 1024 * 1024) {
        const compressed = await compressImage(file);
        setPreview(compressed);
        parseScoreboard(compressed, "image/jpeg", file);
      } else {
        const raw = await readRaw(file);
        setPreview(raw);
        parseScoreboard(raw, file.type || "image/jpeg", file);
      }
    } catch {
      toast({ title: "Failed to process image", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearImage = () => {
    setPreview(null);
    setSelectedFile(null);
    setParsing(false);
    setParseError(null);
    lastParseInput.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const isBlocked = quota.isOverLimit && !quota.isLoading;

  return (
    <>
    <div className="space-y-4">
      {!preview ? (
        <div className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center space-y-4">
          <div className="flex flex-col items-center gap-2">
            <Camera className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Take a photo or upload a screenshot of the post-match scoreboard
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              type="button"
              variant="hero"
              onClick={() => isBlocked ? setShowUpgradeSheet(true) : cameraInputRef.current?.click()}
              className="gap-2"
            >
              <Camera className="w-4 h-4" />
              Take Photo
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => isBlocked ? setShowUpgradeSheet(true) : fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Image
            </Button>
          </div>

          <QuotaMeter quota={quota} onUpgradeClick={() => setShowUpgradeSheet(true)} />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-border/50">
            <img src={preview} alt="Scoreboard" className="w-full object-contain max-h-80" />
            
            {/* Scanning overlay animation */}
            {parsing && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px]" />
                
                {/* Scanning line */}
                <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_15px_hsl(var(--primary)),0_0_30px_hsl(var(--primary)/0.5)]" />
                
                {/* Corner brackets */}
                <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-sm animate-pulse" />
                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-sm animate-pulse" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-sm animate-pulse" />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-sm animate-pulse" />
                
                {/* Status text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm font-medium text-primary bg-background/70 px-3 py-1 rounded-full">
                    Analyzing scoreboard...
                  </span>
                </div>
              </div>
            )}
            
            {!parsing && (
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 hover:bg-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Retry / fallback UI when a parse attempt failed. The cached
              base64 + mimeType in lastParseInput.current means we can rerun
              the parse without the user having to re-select the file. */}
          {!parsing && parseError && lastParseInput.current && (
            <div className="rounded-lg border border-rl-red/30 bg-rl-red/5 px-3 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rl-red shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-rl-red">Couldn't parse this scoreboard</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">
                    {parseError}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <Button
                  type="button"
                  variant="hero"
                  size="sm"
                  onClick={retryParse}
                  className="gap-1.5"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Retry parse
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearImage}
                  className="gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Use different photo
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    <UpgradeSheet
      open={showUpgradeSheet}
      onOpenChange={setShowUpgradeSheet}
      currentTier={quota.tier}
      parsesUsed={quota.parsesUsed}
      quota={quota.quota}
    />
    </>
  );
};

export default ScoreboardUploader;
