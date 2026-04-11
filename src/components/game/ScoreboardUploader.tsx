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
}

interface ParsedScoreboard {
  game_mode: "1v1" | "2v2" | "3v3";
  game_type: "competitive" | "casual";
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

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearImage = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const parseScoreboard = async () => {
    if (!preview || !selectedFile) return;
    setParsing(true);

    try {
      // Convert to base64 (strip the data URL prefix)
      const base64 = preview.split(",")[1];

      const { data, error } = await supabase.functions.invoke("parse-scoreboard", {
        body: { image_base64: base64, user_rl_name: userRlName },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onParsed(data, selectedFile);
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
            {/* Camera capture for mobile */}
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
            <button
              onClick={clearImage}
              className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 hover:bg-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Button
            onClick={parseScoreboard}
            disabled={parsing}
            variant="hero"
            className="w-full gap-2"
          >
            {parsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing scoreboard...
              </>
            ) : (
              "Parse Scoreboard with AI"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScoreboardUploader;
