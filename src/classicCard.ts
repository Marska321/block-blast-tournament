import type { ClassicBoard } from "../shared/classic";

const dateLabel = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("en-ZA", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg",
});

export async function downloadClassicCard(board: ClassicBoard) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");
  ctx.fillStyle = "#102b34";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = "#244650";
  for (let x = 38; x < 1080; x += 40) for (let y = 38; y < 1350; y += 40) {
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  const label = (text: string, x: number, y: number, font: string, color = "#fff4db") => {
    ctx.font = font; ctx.fillStyle = color; ctx.fillText(text, x, y);
  };
  const tile = (x: number, y: number, color: string) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, 34, 34, 8); ctx.fill();
  };
  tile(72, 66, "#ef7855"); tile(112, 66, "#efb94b"); tile(72, 106, "#178d89");
  label("blok blaster.", 170, 112, "600 60px Fredoka");
  label("by Playables", 174, 145, '500 23px "DM Sans"', "#b6c8c7");
  label(board.demo ? "TEST BOARD · NO PRIZES" : "DAILY CLASSIC", 72, 235, '800 25px "DM Sans"', "#96e5ce");
  label(board.closed ? "Today's big hitters." : "The scores to beat.", 72, 317, "600 67px Fredoka");
  label(dateLabel(board.day), 72, 365, '500 29px "DM Sans"', "#b6c8c7");
  label(board.closed ? "FINAL RESULTS · SOUTH AFRICA TIME" : "LIVE SNAPSHOT · NOT FINAL", 72, 405, '800 20px "DM Sans"', "#efb94b");
  ctx.fillStyle = "#213f47"; ctx.beginPath(); ctx.roundRect(62, 456, 956, 262, 30); ctx.fill();
  const winner = board.entries[0];
  label(winner ? "HIGH SCORE OF THE DAY" : "A LITTLE SPACE FOR A NEW CHAMPION", 92, 511, '800 22px "DM Sans"', "#96e5ce");
  label(winner ? winner.score.toLocaleString("en-ZA") : "No ranked runs", 92, 612, "600 94px Fredoka", "#ffda78");
  function fit(text: string, maxWidth: number) {
    let result = text;
    while (ctx!.measureText(result).width > maxWidth && result.length) result = result.slice(0, -1);
    return result === text ? text : result.slice(0, -1) + "…";
  }
  ctx.font = '700 31px "DM Sans"';
  label(winner ? fit(winner.nickname, 850) : "Play. Clear. Come back for another go.", 92, 670, '700 31px "DM Sans"');
  for (let i = 0; i < Math.min(5, board.entries.length); i++) {
    const entry = board.entries[i], y = 795 + i * 72;
    label(String(entry.rank).padStart(2, "0"), 78, y, "600 32px Fredoka", "#96e5ce");
    ctx.font = '600 29px "DM Sans"';
    label(fit(entry.nickname, 570), 155, y, '600 29px "DM Sans"');
    ctx.textAlign = "right";
    label(entry.score.toLocaleString("en-ZA"), 992, y, "500 33px Fredoka", "#ffda78");
    ctx.textAlign = "left";
  }
  label(`${board.participants} player${board.participants === 1 ? "" : "s"} · Best accepted score per player`, 72, 1220, '500 23px "DM Sans"', "#b6c8c7");
  label("No prizes · One free revive · Replay-validated scores", 72, 1260, '500 22px "DM Sans"', "#b6c8c7");
  label("Play in your browser. Follow Playables for updates.", 72, 1300, '700 23px "DM Sans"', "#96e5ce");
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value =>
    value ? resolve(value) : reject(new Error("Could not create the results image.")), "image/png"));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `blok-blaster-${board.demo ? "test-" : ""}${board.day}-${board.closed ? "results" : "live"}.png`;
  // Attach the anchor for mobile/browser download compatibility.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export { dateLabel as classicDateLabel };
