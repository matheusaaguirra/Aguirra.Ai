import { spawn } from "node:child_process";
import { localMode } from "./local-store.ts";

export function serverVoiceAvailable() { return localMode() && process.platform === "win32"; }
export function speechText(text: string) { return text.replace(/https?:\/\/\S+/g, "").replace(/[#*_`]/g, "").slice(0, 6000).trim(); }
// User text is sent via stdin. It is never interpolated into PowerShell code.
const script = `
$ErrorActionPreference='Stop'
[Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$text=[Console]::In.ReadToEnd()
$synth=[System.Speech.Synthesis.SpeechSynthesizer]::new()
$pt=$synth.GetInstalledVoices() | Where-Object {$_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'pt-BR'} | Select-Object -First 1
if($pt){$synth.SelectVoice($pt.VoiceInfo.Name)}
if(!$pt){$pt=$synth.GetInstalledVoices() | Where-Object {$_.Enabled -and $_.VoiceInfo.Culture.Name -like 'pt-*'} | Select-Object -First 1;if($pt){$synth.SelectVoice($pt.VoiceInfo.Name)}}
if(!$pt){throw 'Instale uma voz em portugues no Windows.'}
$stream=[System.IO.MemoryStream]::new()
try {
  $synth.SetOutputToWaveStream($stream)
  $synth.Speak($text)
  $synth.SetOutputToNull()
  $bytes=$stream.ToArray()
  [Console]::OpenStandardOutput().Write($bytes,0,$bytes.Length)
} finally {$synth.Dispose();$stream.Dispose()}
`;
let rendering = false;
export async function synthesizeWave(text: string): Promise<Uint8Array> {
  if (!serverVoiceAvailable()) throw new Error("Voz do computador disponível no modo local em Windows. Use a voz do navegador neste aparelho.");
  if (rendering) throw new Error("Aguarde a preparação do áudio anterior.");
  rendering = true;
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      const chunks: Buffer[] = []; let bytes = 0, finished = false;
      const timer = setTimeout(() => { child.kill(); done(new Error("A preparação da voz excedeu o tempo de espera.")); }, 60_000);
      function done(error?: Error) { if (finished) return; finished = true; clearTimeout(timer); if (error) reject(error); else { const wave = Buffer.concat(chunks); if (wave.toString("ascii",0,4) !== "RIFF" || wave.toString("ascii",8,12) !== "WAVE") reject(new Error("O Windows não produziu um áudio WAV válido.")); else resolve(wave); } }
      child.stdout.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) { child.kill(); done(new Error("Áudio muito longo.")); } else chunks.push(chunk); });
      child.stderr.on("data", () => { /* Do not log private reply text or speech engine diagnostics. */ });
      child.on("error", () => done(new Error("Não foi possível abrir a voz sintética do Windows.")));
      child.on("close", code => done(code === 0 ? undefined : new Error("Confira se existe uma voz instalada no Windows.")));
      child.stdin.on("error", () => undefined); child.stdin.end(speechText(text), "utf8");
    });
  } finally { rendering = false; }
}
