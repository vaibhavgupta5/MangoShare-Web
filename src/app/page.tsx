"use client";
import React, { useRef, useState } from "react";
import { FileIcon, ImageIcon, VideoIcon, ArchiveIcon, Share2, Users, Sun, Moon, QrCode, Copy, X } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import Image from "next/image";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000");

export default function FileSharePage() {
  const { theme, setTheme } = useTheme();
  
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  // Get code from URL if present
  const urlParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const codeFromUrl = urlParams?.get("code") || "";
  const receiverModeFromUrl = urlParams?.get("mode") === "receiver";

  const [roomId, setRoomId] = useState(codeFromUrl);
  const [filename, setFilename] = useState("");
  const [sharer, setSharer] = useState("");
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"sender" | "receiver" | "">(
    receiverModeFromUrl ? "receiver" : ""
  );
  const [incomingFile, setIncomingFile] = useState<{
    filename: string;
    sharer: string;
    size?: number;
    type?: string;
  } | null>(null);
  const [roomJoined, setRoomJoined] = useState(false);
  const [fileSent, setFileSent] = useState(false);
  const [fileReceived, setFileReceived] = useState(false);
  const [receivedChunks, setReceivedChunks] = useState<Array<ArrayBuffer>>([]);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [receiverConnected, setReceiverConnected] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [showQrDialog, setShowQrDialog] = useState(false);

  // Generate QR code for receiver link
  const generateQRCode = async (link: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(link, {
        width: 256,
        margin: 2,
        color: {
          dark: '#FACC15', // Yellow color
          light: '#0A0A0A'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
      setShowQrDialog(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    }
  };

  // Copy link to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy link');
    }
  };

  // Generate 6-digit code
  function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // When sender selects mode, generate code and join room automatically
  React.useEffect(() => {
    if (mode === "sender" && !roomId) {
      const code = generateCode();
      setRoomId(code);
      setTimeout(() => {
        socket.emit("join-room", code);
        setRoomJoined(true);
      }, 100);
    }
    if (mode === "receiver" && roomId && !roomJoined) {
      socket.emit("join-room", roomId);
      setRoomJoined(true);
    }
  }, [mode, roomJoined]);

  // Sender can copy link for receiver
  const getReceiverLink = () => {
    if (!roomId) return "";
    return `${window.location.origin}?code=${roomId}&mode=receiver`;
  };

  const sendFile = () => {
    const file = fileRef.current?.files?.[0] || null;
    if (!file || !roomId || !sharer) return;

    setFilename(file.name);
    setFileSent(false);

    // Show image preview for sender
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) setImagePreviewUrl(e.target.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreviewUrl("");
    }

    socket.emit("file-meta", roomId, {
      filename: file.name,
      sharer,
      size: file.size,
      type: file.type,
    });

const chunkSize = 1024 * 1024; 
    let offset = 0;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const chunk = e.target.result as ArrayBuffer;
        offset += chunk.byteLength;
        const percent = Math.round((offset / file.size) * 100);
        setProgress(percent);
        socket.emit("file-chunk", roomId, chunk, percent);

        if (offset < file.size) {
          readNextChunk();
        } else {
          setFileSent(true);
        }
      }
    };

    function readNextChunk() {
      if (!file) return;
      const next = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(next);
    }

    readNextChunk();
  };

  React.useEffect(() => {
    socket.on("file-meta", (meta) => {
      setIncomingFile(meta);
      setProgress(0);
      setFileReceived(false);
      setReceivedChunks([]);
      setDownloadUrl("");
      setImagePreviewUrl("");
      toast.info(`Receiving file: ${meta.filename} from ${meta.sharer}`);
    });
    socket.on("file-chunk", (chunk, percent) => {
      setProgress(percent);
      setFileReceived(percent === 100);
      setReceivedChunks((prev) => [...prev, chunk as ArrayBuffer]);
      if (percent === 100) {
        toast.success("File received successfully!");
      }
    });
    socket.on("receiver-joined", () => {
      setReceiverConnected(true);
      toast.success("Receiver connected!");
    });
    socket.on("receiver-left", () => {
      setReceiverConnected(false);
      toast.warning("Receiver disconnected");
    });
    socket.on("room-full", () => {
      toast.error("Room is full. Only 2 users allowed per room.");
    });
    return () => {
      socket.off("file-meta");
      socket.off("file-chunk");
      socket.off("receiver-joined");
      socket.off("receiver-left");
      socket.off("room-full");
    };
  }, []);

  React.useEffect(() => {
    if (fileReceived && incomingFile && receivedChunks.length) {
      const mimeType = incomingFile.type || "application/octet-stream";
      const blob = new Blob(receivedChunks, { type: mimeType });
      setDownloadUrl(URL.createObjectURL(blob));
      // If image, show preview
      if (mimeType.startsWith("image/")) {
        setImagePreviewUrl(URL.createObjectURL(blob));
      }
    }
  }, [fileReceived, incomingFile, receivedChunks]);

  return (
    <div className="min-h-screen bg-background cyber-grid relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/20 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-primary/30 rounded-full animate-ping"></div>
        <div className="absolute top-1/2 left-3/4 w-1.5 h-1.5 bg-primary/25 rounded-full animate-pulse"></div>
      </div>

      <div className="relative z-10 container max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold neon-text animate-pulse-neon mb-2 font-mono">
            MANGO<span className="text-primary">SHARE</span>
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            &gt; SECURE P2P FILE TRANSFER _
          </p>
          
          {/* Theme Toggle */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              className="switch-neon cursor-pointer"
            />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Main Card */}
        <Card className="card-hover bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            {/* Status Display */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 font-mono text-sm">
                <span className="text-muted-foreground">[ROOM]</span>
                <span className="text-primary neon-text">
                  {roomJoined ? roomId : "DISCONNECTED"}
                </span>
                {roomJoined && (
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                )}
              </div>
              {receiverConnected && mode === "sender" && (
                <div className="text-xs text-green-400 font-mono">
                  &gt; RECEIVER_ONLINE
                </div>
              )}
            </div>

            {/* Mode Selection */}
            {!mode && (
              <div className="space-y-4">
                <div className="text-center text-sm text-muted-foreground font-mono">
                  SELECT_MODE:
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => setMode("sender")}
                    className="btn-neon h-12 font-mono cursor-pointer"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    SENDER
                  </Button>
                  <Button
                    onClick={() => setMode("receiver")}
                    variant="outline"
                    className="h-12 font-mono dark:hover:text-white neon-border cursor-pointer"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    RECEIVER
                  </Button>
                </div>
              </div>
            )}

            {/* Sender Mode */}
            {mode === "sender" && (
              <div className="space-y-4">
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMode("");
                      setRoomJoined(false);
                      setRoomId("");
                    }}
                    className="text-xs font-mono text-muted-foreground cursor-pointer"
                  >
                    &lt; CHANGE_MODE
                  </Button>
                </div>

                <div className="space-y-3">
                  <Input
                    placeholder="ENTER_YOUR_NAME"
                    value={sharer}
                    onChange={(e) => setSharer(e.target.value)}
                    className="input-neon font-mono bg-background/50"
                  />
                  
                  <div className="file-upload-area rounded-lg p-4 text-center">
                    <input
                      type="file"
                      ref={fileRef}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFilename(file.name);
                          // Show preview before sending
                          if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) setImagePreviewUrl(ev.target.result as string);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            setImagePreviewUrl("");
                          }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      className="w-full font-mono neon-border dark:text-white cursor-pointer"
                    >
                      <FileIcon className="h-4 w-4 mr-2 dark:text-white" />
                      SELECT_FILE
                    </Button>
                  </div>

                  {filename && (
                    <div className="p-3 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-2 text-sm font-mono">
                        {filename.includes('.zip') ? (
                          <ArchiveIcon className="h-4 w-4 text-primary" />
                        ) : imagePreviewUrl && incomingFile?.type?.startsWith("image/") ? (
                          <ImageIcon className="h-4 w-4 text-primary" />
                        ) : imagePreviewUrl && incomingFile?.type?.startsWith("video/") ? (
                          <VideoIcon className="h-4 w-4 text-primary" />
                        ) : (
                          <FileIcon className="h-4 w-4 text-primary" />
                        )}
                        <span className="truncate">{filename}</span>
                      </div>
                      
                        <div className="mt-3">
                          {incomingFile?.type?.startsWith("image/") ? (
                            <Image
                              src={imagePreviewUrl}
                              alt="preview"
                              width={200}
                              height={128}
                              className="w-full h-32 object-cover rounded border border-border"
                            />
                          ) : incomingFile?.type?.startsWith("video/") ? (
                            <video
                              src={imagePreviewUrl}
                              controls
                              className="w-full h-32 rounded border border-border"
                            />
                          ) : null}
                        </div>
                    </div>
                  )}

                  <Button
                    onClick={sendFile}
                    disabled={!filename || !sharer}
                    className="w-full btn-neon font-mono cursor-pointer"
                  >
                    TRANSMIT_FILE
                  </Button>

                  {fileSent && (
                    <div className="text-center text-green-400 text-xs font-mono">
                      &gt; FILE_TRANSMITTED_SUCCESSFULLY
                    </div>
                  )}

                  {progress > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span>PROGRESS:</span>
                        <span className="text-primary">{progress}%</span>
                      </div>
                      <Progress value={progress} className="progress-neon" />
                    </div>
                  )}

                  {/* Share Link */}
                  {roomId && (
                    <div className="p-3 rounded-lg bg-background/30 border border-primary/20">
                      <div className="text-xs font-mono text-muted-foreground mb-2">
                        SHARE_LINK:
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={getReceiverLink()}
                          readOnly
                          className="text-xs font-mono bg-background/50 flex-1"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(getReceiverLink())}
                          className="px-2 neon-border cursor-pointer dark:text-white"
                        >
                          <Copy className="h-3 w-3 text-primary" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateQRCode(getReceiverLink())}
                          className="px-2 neon-border cursor-pointer dark:text-white"
                        >
                          <QrCode className="h-3 w-3 text-primary" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        &gt; SEND_TO_RECEIVER
                      </div>
                    </div>
                  )}

                  {/* QR Code Dialog */}
                  <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
                    <DialogContent className="sm:max-w-md bg-card border border-primary/20">
                      <DialogHeader>
                        <DialogTitle className="font-mono text-primary">
                          QR_CODE_SCANNER
                        </DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col items-center space-y-4">
                        {qrCodeDataUrl && (
                          <div className="p-4 bg-white rounded-lg">
                            <Image
                              src={qrCodeDataUrl}
                              alt="QR Code"
                              width={256}
                              height={256}
                              className="rounded"
                            />
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground font-mono text-center">
                          SCAN_WITH_MOBILE_DEVICE
                        </p>
                        <div className="flex gap-2 w-full">
                          <Button
                            variant="outline"
                            onClick={() => copyToClipboard(getReceiverLink())}
                            className="flex-1 font-mono cursor-pointer dark:text-white"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            COPY_LINK
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowQrDialog(false)}
                            className="flex-1 font-mono cursor-pointer dark:text-white"
                          >
                            <X className="h-4 w-4 mr-2" />
                            CLOSE
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}

            {/* Receiver Mode */}
            {mode === "receiver" && (
              <div className="space-y-4">
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMode("");
                      setRoomJoined(false);
                      setRoomId("");
                    }}
                    className="text-xs font-mono text-muted-foreground"
                  >
                    &lt; CHANGE_MODE
                  </Button>
                </div>

                {!roomJoined && (
                  <div className="space-y-3">
                    <Input
                      placeholder="ENTER_ROOM_CODE"
                      value={roomId}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 6) {
                          setRoomId(value);
                        }
                      }}
                      // onKeyDown={(e) => {
                      //   if (e.key === 'Enter' && roomId && roomId.length === 6) {
                      //     socket.emit("join-room", roomId);
                      //     setRoomJoined(true);
                      //     toast.success("Connected to room!");
                      //   }
                      // }}
                      className="input-neon font-mono bg-background/50"
                      maxLength={6}
                      type="text"
                      inputMode="numeric"
                    />
                    <Button
                      onClick={() => {
                        if (roomId && roomId.length === 6) {
                          socket.emit("join-room", roomId);
                          setRoomJoined(true);
                          toast.success("Connected to room!");
                        }
                      }}
                      disabled={!roomId || roomId.length !== 6}
                      className="w-full btn-neon font-mono cursor-pointer"
                    >
                      CONNECT_TO_ROOM
                    </Button>
                  </div>
                )}

                {incomingFile ? (
                  <div className="p-4 rounded-lg bg-background/50 border border-border space-y-3">
                    <div className="flex items-center gap-2 text-sm font-mono">
                      {incomingFile.filename.includes('.zip') ? (
                        <ArchiveIcon className="h-4 w-4 text-primary" />
                      ) : incomingFile?.type?.startsWith("image/") ? (
                        <ImageIcon className="h-4 w-4 text-primary" />
                      ) : incomingFile?.type?.startsWith("video/") ? (
                        <VideoIcon className="h-4 w-4 text-primary" />
                      ) : (
                        <FileIcon className="h-4 w-4 text-primary" />
                      )}
                      <span className="truncate">{incomingFile.filename}</span>
                    </div>
                    
                    <div className="text-xs font-mono text-muted-foreground">
                      FROM: {incomingFile.sharer}
                      {incomingFile.size && ` | SIZE: ${incomingFile.size} BYTES`}
                    </div>

                    {progress > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span>DOWNLOADING:</span>
                          <span className="text-primary">{progress}%</span>
                        </div>
                        <Progress value={progress} className="progress-neon" />
                      </div>
                    )}

                      {imagePreviewUrl && (
                        <div className="mt-3">
                          {incomingFile?.type?.startsWith("image/") ? (
                            <Image
                              src={imagePreviewUrl}
                              alt="preview"
                              width={200}
                              height={128}
                              className="w-full h-32 object-cover rounded border border-border"
                            />
                          ) : incomingFile?.type?.startsWith("video/") ? (
                            <video
                              src={imagePreviewUrl}
                              controls
                              className="w-full h-32 rounded border border-border"
                            />
                          ) : null}
                        </div>
                      )}

                    {fileReceived && downloadUrl && (
                      <Button
                        asChild
                        className="w-full btn-neon font-mono cursor-pointer"
                      >
                        <a href={downloadUrl} download={incomingFile.filename}>
                          DOWNLOAD_FILE
                        </a>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8 border border-dashed border-border rounded-lg">
                    <div className="text-muted-foreground font-mono text-sm">
                      WAITING_FOR_FILE...
                    </div>
                    <div className="mt-2 flex justify-center">
                      <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cool Instructions Section */}
        <Card className="card-hover bg-card/60 backdrop-blur-sm border border-primary/30 border-glow mt-4">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-primary font-mono neon-text animate-neon-flicker">
                &gt; HOW_TO_USE_MANGOSHARE
              </h2>
              <div className="w-16 h-0.5 bg-primary mx-auto mt-2 "></div>
            </div>
            
            <div className="space-y-4 text-sm font-mono terminal-text">
              {/* Sender Instructions */}
              <div className="border-l-2 border-primary/50 pl-4 animate-slide-in" style={{animationDelay: '0.1s'}}>
                <div className="text-primary font-semibold mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  [SENDER_MODE]:
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <div className="hover:text-primary transition-colors duration-300">
                    • SELECT_SENDER → ENTER_NAME → CHOOSE_FILE
                  </div>
                  <div className="hover:text-primary transition-colors duration-300">
                    • ROOM_AUTO_GENERATED → SHARE_LINK_OR_QR
                  </div>
                  <div className="hover:text-primary transition-colors duration-300">
                    • WAIT_FOR_RECEIVER → TRANSMIT_FILE
                  </div>
                </div>
              </div>

              {/* Receiver Instructions */}
              <div className="border-l-2 border-yellow-400/50 pl-4 animate-slide-in" style={{animationDelay: '0.2s'}}>
                <div className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  [RECEIVER_MODE]:
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <div className="hover:text-yellow-400 transition-colors duration-300">
                    • SELECT_RECEIVER → ENTER_ROOM_CODE
                  </div>
                  <div className="hover:text-yellow-400 transition-colors duration-300">
                    • OR_SCAN_QR_CODE → CONNECT_TO_ROOM
                  </div>
                  <div className="hover:text-yellow-400 transition-colors duration-300">
                    • WAIT_FOR_FILE → DOWNLOAD_COMPLETE
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="border-l-2 border-green-400/50 pl-4 animate-slide-in" style={{animationDelay: '0.3s'}}>
                <div className="text-terminal-green font-semibold mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  [FEATURES]:
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <div className="hover:text-terminal-green transition-colors duration-300">
                    • P2P_DIRECT_TRANSFER → NO_SERVER_STORAGE
                  </div>
                  <div className="hover:text-terminal-green transition-colors duration-300">
                    • IMAGE/VIDEO_PREVIEW → FILE_TYPE_ICONS
                  </div>
                  <div className="hover:text-terminal-green transition-colors duration-300">
                    • QR_CODE_SHARING → COPY_LINK_BUTTON
                  </div>
                  <div className="hover:text-terminal-green transition-colors duration-300">
                    • REAL_TIME_PROGRESS → MAX_2_USERS_PER_ROOM
                  </div>
                </div>
              </div>

              {/* Security Note */}
              <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 animate-slide-in" style={{animationDelay: '0.4s'}}>
                <div className="flex items-center gap-2 text-primary text-xs">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span className="font-semibold">SECURITY_NOTE:</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  FILES_TRANSFER_DIRECTLY_BETWEEN_DEVICES • NO_CLOUD_STORAGE • ROOM_EXPIRES_ON_DISCONNECT
                </div>
              </div>

              {/* Quick Start */}
              <div className="mt-4 p-3 rounded-lg bg-cyan-400/10 border border-cyan-400/20 animate-slide-in" style={{animationDelay: '0.5s'}}>
                <div className="flex items-center gap-2 text-terminal-cyan text-xs">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span className="font-semibold">QUICK_START:</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  SENDER: CLICK_SENDER → NAME + FILE → SHARE_QR_CODE<br/>
                  RECEIVER: CLICK_RECEIVER → SCAN_QR → DOWNLOAD_FILE
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-muted-foreground font-mono">
          &copy; 2025 MANGOSHARE | SECURE_P2P_TRANSFER
        </div>
      </div>
    </div>
  );
}
