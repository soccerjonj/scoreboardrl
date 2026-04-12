import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParsedPlayer {
  name: string;
  team: "blue" | "orange";
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  is_mvp: boolean;
  mmr?: number | null;
  mmr_change?: number | null;
}

interface ParsedScoreboard {
  game_mode: "1v1" | "2v2" | "3v3";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1920;
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
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const parseScoreboard = async (base64: string) => {
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-scoreboard", {
        body: {
          image_base64: base64.split(",")[1],
          user_rl_name: userRlName,
          mime_type: "image/jpeg",
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onParsed(data, file);
      toast({ title: "Scoreboard parsed!", description: `Found ${data.players.length} players in a ${data.game_mode} ${data.game_type} game.` });
    } catch (err: any) {
      toast({
        title: "Failed to parse scoreboard",
        description: err.message || "Try again or enter stats manually.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      parseScoreboard(compressed);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
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
              onClick={() => cameraInputRef.current?.click()}
              className="gap-2"
            >
              <Camera className="w-4 h-4" />
              Take Photo
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Image
            </Button>
          </div>

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
        </div>
      )}
    </div>
  );
};

export default ScoreboardUploader;
