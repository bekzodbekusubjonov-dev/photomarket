# Rasmlar manifesti (Pexels, bepul litsenziya)

Barcha rasmlar takrorlanmaydi: bitta Pexels ID faqat bitta joyda ishlatiladi. Manzil: `https://www.pexels.com/photo/<ID>/`.

## Sayt bo'limlari (`backend/app/images.py`)

| Slot | Pexels ID |
|---|---|
| hero_main | 1721942 |
| hero_side | 1838 |
| hero_small | 2333713 |
| how | 3928550 |
| cta | 14408918 |
| auth | 302035 |
| auth_register | 16597255 |
| cover | 7417907 |
| cat_wedding | 13470038 |
| cat_love | 5055872 |
| cat_portrait | 3785844 |
| cat_family | 4879441 |
| cat_kids | 6148507 |
| cat_corporate | 8761674 |
| cat_product | 7317129 |
| cat_event | 1105666 |

## Demo ijodkorlar (`backend/app/cli.py`)

| Ijodkor | Avatar | Portfolio (Pexels ID) |
|---|---|---|
| Aziz Karimov | 30767572 | 9755941, 863098, 3361200, 19679440, 4873577, 160803 |
| Malika Studio | 30004322 | 38758066, 30697993, 39513498, 34381970, 2709388 |
| Jasur Media | 12437056 | 19439122, 4941721, 2363675, 6942523, 878998 |
| Dilnoza Foto | 5379785 | 267885, 1205651, 9604191, 31649570, 16110767 |
| Sardor Production | 29856511 | 7647995, 28728922, 5314217, 2263435, 39705635 |
| Nodira Kids | 4906289 | 8104206, 3341189, 10998327, 8088381, 2608519 |
| Bekzod Product | 31268612 | 7797009, 306059, 3298057, 15061732, 13516802 |
| Kamola Wedding | 3763156 | 5729135, 7994345, 15524744, 9915424, 4352151 |

Muqova rasmi: ijodkor o'zi yuklamaguncha portfoliodagi birinchi rasm ko'rsatiladi.
Rasm ochilmasa, sayt avtomatik neytral zaxira rasmlarga (`frontend/public/photos/f1–f4.webp`) o'tadi.
`python -m app.cli fetch-images` rasmlarni bir marta yuklab, serverning o'ziga saqlaydi.
