# Bank marks

Each file here is the bank's own mark, taken from that bank's public website and
used nominatively — to name the institution you are connecting an account to.

| File | Bank | Source |
| --- | --- | --- |
| `hapoalim.png` | Bank Hapoalim | `bankhapoalim.co.il` — `apple-touch-icon.png` |
| `leumi.png` | Bank Leumi | `leumi.co.il` — `s3fs-public/logo/logoLeumi.png` |
| `discount.png` | Discount Bank | `discountbank.co.il` — `apple-touch-icon.png` |
| `otsarHahayal.png` | Otsar HaHayal | `apps.fibi.co.il/logo/014_logo.png` — leading glyph, recomposed on the brand navy their own favicon uses, because that favicon is only 32×32 and goes soft on a 40px tile |
| `visaCal.png` | Visa Cal | `cal-online.co.il` — `favicon.ico`, 48×48 frame |
| `max.png` | Max | `max.co.il` — `assets/images/favicon.ico`, 48×48 frame |
| `isracard.png` | Isracard | `isracard.co.il` — the 192×192 icon it points at on `static.wixstatic.com` |

Cal and Max are 48×48 because that is genuinely all either publishes: Cal serves
its site behind a WAF that rejects every asset path except `favicon.ico`, and
Max's `manifest.json` is an SPA fallback that returns the homepage rather than an
icon set. Max also publishes a vector wordmark, but a wide `MAX` lockup renders
as a few pixels of text on a square tile, where the favicon's `M` mark matches
the other marks' weight.

Each is padded to a square canvas at its own resolution, capped at 128px and
never upscaled: a blurry stored file is worse than letting the browser scale a
sharp one.

They are wired up through the `logo` field in `src/constants/banks.ts`. A path
that points at nothing fails silently in the browser — `BankIcon` drops the tile
back to the bank's monogram, colour included — so `BankIcon.test.tsx` asserts
every declared logo resolves to a file that exists.

To add another bank, drop a square PNG here and set its `logo` path. No
component needs to change.
