# NovelAI Image Generation Settings & Style Presets

## 1. 하드웨어/엔진 공통 설정 (Global Settings)

| 항목 | 기본 권장값 | 변형 (안정성/NSFW) | 변형 (배경/디테일) |
| :--- | :--- | :--- | :--- |
| **Model** | NAI 3 / 4.5F | - | - |
| **Steps** | 28 | 28 | 28 |
| **Sampler** | Euler Ancestral | - | - |
| **Noise Schedule** | karras | - | - |
| **Prompt Guidance** | 6.0 | **6.0** | **6.0** |
| **Guidance Rescale**| **0.6** | **0.2** | **0.5** |

> **💡 설정 팁:**
> - **Rescale 0.2:** 깨짐 현상이 적고 손가락 오류가 적음. NSFW 결과물이 안정적이나 AI 특유의 느낌이 강해질 수 있음 (네거티브 가중치를 낮추는 것 추천).
> - **Rescale 0.5~0.6:** 배경 퀄리티와 화풍의 질감이 풍부해짐.

---

## 2. 스타일 프리셋 (Style 01 ~ 06)

### [Style 01] 웹소설 컬러 삽화풍
- **특징:** 회화적이고 러프한 느낌. 
- **팁:** 러프한 느낌을 빼고 싶다면 Negative에서 `blender`를 제외할 것.
- **Base:** `1girl,solo,2.8::artist:viper18_::,2.6::artist:gmkj::,2.5::artist:dolechan::,2.5::artist:shiwudesu::,2.0::artist:pingpangpongpang::,2.0::artist:rhtkd::,1.5::artist:nervi_fd::,1.4::artist:dayday_(day_1day)::,0.7::artist:ness_(pjw0168)::,0.5::artist:joacy::,0.5::artist:kokemomo_(makesound)::,0.5::artist:dora_(garyeong)::,0.4::artist:krabking::,0.3::artist:fymrie::,0.0::artist:ru_zhai::, year 2026, year 2025, year 2024, masterpiece, best quality, high quality, amazing quality, very aesthetic, highres, high detail, best illustration, detailed eyes, detailed pupils, dynamic angle, cowboy shot, 1.5::cinematic lighting, volumetric lighting, novel illustration, flat color, thick eyelashes, game cg::, -3::artist collaboration, bad anatomy::, -1:: chibi, creature::, 3.0::theme:Fantasy::, very aesthetic, masterpiece, no text`

### [Style 02] 몽환적/그윽한 눈빛
- **특징:** 파스텔 톤, 은은하고 부드러운 분위기.
- **Base:** `1girl, solo, 2.6::artist:ness_(pjw0168)::,2.6::artist:0haribo0_::,2.6::artist:ppolar::,2.6::artist:pomi_(poan_dan)::,2.4::artist:rororo::,2.0::artist:krabking::, 1.8::artist:dayday_(day_1day)::,1.8::artist:onigirikao::,1.5::artist:takamatu_hajime::,1.4::artist:shiwudesu::,1.3::artist:rhtkd::,1.3::artist:fantongjun::,1.3::artist:joacy::,1.2::artist:viper18_::,1.0::artist:gmkj::,0.8::artist:anyak05_::,0.8::artist:nervi_fd::,0.7::artist:ru_zhai::,0.6::artist:pingpangpongpang::, year 2026, year 2025, year 2024, masterpiece, best quality, high quality, amazing quality, very aesthetic, highres, high detail, best illustration, detailed eyes, detailed pupils, dynamic angle, cowboy shot, 1.5::nostalgic, soft atmosphere, pastel colors, rough lines, cinematic lighting, volumetric lighting::, -3::artist collaboration, bad anatomy::, -1:: chibi, creature, flat color::, 3.0::theme:Fantasy::, very aesthetic, masterpiece, no text`

### [Style 03] SF/판타지 (파티클 강조)
- **특징:** SF/판타지 특유의 입자 효과, 무심한 표정.
- **Base:** `1girl, solo, 1.1::artist:zhibuji loom::, 2.6::artist:lunch (shin new)::, 0.7::artist:sano yuuto::, 1.1::artist:ame (uten cancel)::, 1.1::artist:dorontabi::, 1.0::artist:tinklebell::, 0.9::artist:azmira1534815 ::, 1.7::artist:ohisashiburi::, 0.8::artist:freng::, 2.4::artist:healthyman::, 1.9::artist:mx2j::, 2.2::artist:ciloranko::, 2.5::artist:gogalking::, 1.4::artist:higashiyama shou::, 0.9::artist:channel_(caststation)::, 2.4::artist:solipsist::, year 2026, year 2025, year 2024, masterpiece, best quality, high quality, amazing quality, very aesthetic, highres, high detail, best illustration, novel illustration, game cg, dynamic angle, cowboy shot ,no text, no text, 2.0::no line art, colorful line, simple background::, -3::artist collaboration, bad anatomy, simple illustration::, 3.0::theme:SF::, very aesthetic, masterpiece, no text`

### [Style 04] 유색 선/노곤한 분위기
- **특징:** 컬러풀한 선과 옅은 색 경계가 주는 묘한 분위기.
- **Base:** `1girl, solo, 2.6::artist:mx2j::, 2.2::artist:doremi (doremi4704)::, 2.0::artist:shanyao jiang tororo::, 1.8::artist:yd (orange maru)::, 1.7::artist:deadflow::, 0.5::artist:cocoballking::, 0.8::artist:artist:ningen mame::, 1.0::artist:ezu (e104mjd)::, 0.8::artist:naga U::, year 2025, year 2024, shiny skin, detailed eyes, blush, -3::artist collaboration::, {{{masterpiece, best quality, high quality, amazing quality, very aesthetic}}}, highres, absurdres, soft lighting, volumetric lighting, 1.5::theme:Fantasy::, very aesthetic, masterpiece, no text`

### [Style 05] 따뜻한 홍조/강한 선
- **특징:** 홍조 표현과 뚜렷한 선. (NSFW 시 특정 부위 묘사가 뚜렷함)
- **Base:** `1girl, solo, 2.8::artist:shiokonbu::, 2.6::artist:parsley-f::, 2.3::artist:channel_(caststation)::, 2.0::artist:imigimuru::, 1.7::artist:wagashi_(dagashiya)::, 1.6::artist:baffu::, 1.4::artist:ikeuchi tanuma::, 1.3::artist:sparrowl::, 1.1::artist:freng::, 0.9::artist:kezime::, year 2025, year 2024, shiny skin, detailed eyes, blush, -1::flat color::, -2::comic::, -1::empty eyes::, -3::artist collaboration::, {{{best quality, amazing quality, very aesthetic}}}, highres, absurdres, soft lighting, volumetric lighting, 1.3::sparkling eyes::, very aesthetic, masterpiece, no text`

### [Style 06] 비누향/밝은 아침 분위기
- **특징:** 밝은 조명, 따뜻한 햇살 확산 효과. 
- **주의:** SFW를 의도해도 NSFW 빈도가 높으므로 주의 필요.
- **Base:** `1girl, solo, 2.5::artist:shanyao jiang tororo::, 2.3::artist:yd (orange maru)::, 2.1::artist:deadflow::, 2.0::artist:higashide irodori::, 1.8::artist:healthyman::, 1.7::artist:wagashi (dagashiya)::, 1.6::artist:freng::, 1.6::artist:ciloranko::, 1.5::artist:wanke::, 1.5::artist:ie (raarami)::, 1.4::artist:null (nyanpyoun)::, 1.3::artist:pottsness::, 1.3::artist:eonsang::, 1.3::artist:2n5 ::, 1.2::artist:qiandaiyiyu::, 1.2::artist:bacius::, 1.1::artist:sparrowl::, 1.0::artist:poper_(arin_sel)::, year 2024, year 2025, year 2026, 1.5::masterpiece, best quality, finely detail, amazing quality, very aesthetic, highres, incredibly absurdres, location, uncensored, ultra high resolution::, animated, dynamic angle, soft illumination, warm sunlight diffusion, pastel scattering, hazy warm glow, soft matte skin, subtle dewy softness, clean soft lineart, smooth gradient shading, gentle highlight, soft blush, expressive soft face, dreamy warm mood, soft curves, cozy airy atmosphere, laundromat mood, 1.1::theme:fantasy::, -3::realistic art style::, -1.5::overly shiny skin::, -1::hard shadows::, no text, very aesthetic, masterpiece, no text`

---

## 3. 심화 작가 조합 (Advanced Artist Mixes)

### [Mix A] 3D/블렌더 입체감 강조 (실사풍 한 방울)
- **추천 프롬프트:** `1.8::artist:kim eb ::, 1.5::artist:ash echoes ::, 1.3::artist:quasarcake ::, 1.2::artist:channel (caststation) ::, 1.1::artist:tab head ::, 1.1::artist:torino aqua ::, 0.5::artist:kim hyung tae ::, 0.9::artist:mika pikazo ::, 0.8::artist:bacius ::, 0.5::artist:wanke ::, artist:qiandaiyiyu, 0.5::artist:cutesexyrobutts ::, 0.5::artist:freng ::, year 2025, year 2024, 2::3d ::, 2::blender (medium) ::, detailed eyes, silky skin, detailed skin texture, ultra detailed, high detail, masterpiece, best quality, very aesthetic, highres, best illustration, novel illustration, -3::simple illustration ::, -1::censored ::, -3::artist collaboration ::, -3::multiple views, duplicate::`

### [Mix B] 깔끔한 애니 컬러링 (안정성 최우선)
- **추천 프롬프트:** `1girl, solo, artist: 0.75::mx2j, 1.2::ogre_(illustogre), 0.7::alna_(mu5fal) , ask (asqzy), hamao, 0.4::repi::, year 2025, year 2024, best quality, amazing quality, very aesthetic, highres, incredibly absurdres, -1::censored, bad anatomy, flat color::, 2::redrawn::, -1:: bad hands::, simple background, 2::anime coloring::, muted color`
- **권장 설정:** Guidance 6, Rescale 0.2

### [Mix C] 배경 조화 및 고퀄리티 일러스트
- **추천 프롬프트:** `artist:freng, artist:murata yuusuke, 1.2::artist:mx2j::, artist:aoi nagisa (metalder), 0.6::artist:oda non::, 1.3::artist:lunch(shin new)::, 1.6::artist:duoyuanjun::, year 2025, year 2024, year 2023, solo artist, -5.3::artist collaboration::, -1::faux retro artstyle::, -1::film grain::, -1::clean text::, -1::flat color::, clean lines, realistic, natural, incredibly absurdres, very aesthetic, highres, masterpiece, best quality, amazing quality, -3::simple illustration::, best illustration, novel illustration, -1::multiple views, character sheet::`

---

## 4. 공통 Negative (Undesired Content)

### [기본 범용 네거티브]
```text
blank page, text, logo, watermark, copyright, too many watermarks, reference, signature, artist name, dated, artistic error, scan artifacts, jpeg artifacts, upscaled, aliasing, film grain, heavy film grain, dithering, chromatic aberration, digital dissolve, halftone, screentones, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist collaboration, one-hour drawing challenge, toon (style), 1990s (style), 4koma, 2koma, mutation, multiple views, character sheet, split screen, deformed, distorted, disfigured, bad anatomy, unnatural hair, bad face, mob face, bad eyes, empty eyes, bad proportions, bad limbs, amputee, bad arm, bad hands, bad hand structure, extra digits, fewer digits, bad leg, extra leg, distorted composition, bad perspective, multiple views, disorganized colors, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, subpar, poor, blurry, lowres, worst quality, bad quality, fewer details, bad portrait, bad illustration, monochrome, spot color
```

### [채널 최적화 네거티브 (안정성 강조)]
```text
negative space, blank page, text, logo, watermark, too many watermarks, reference, signature, artist name, subtitles, captions, clitoris, dated, chibi, artistic error, scan artifacts, jpeg artifacts, aliasing, chromatic aberration, digital dissolve, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist collaboration, one-hour drawing challenge, 4koma, 2koma, mutated, mutation, deformed, distorted, disfigured, bad anatomy, unnatural hair, bad face, mob face, cloned face, distorted face, poorly drawn face, ugly, bad eyes, empty eyes, extra eyes, lazy eye, asymmetrical eyes, cross-eyed, bad proportions, wrong body proportions, unrealistic proportions, distorted body, long neck, wrong head size, bad limbs, missing limbs, extra limbs, amputee, bad arm, bad hands, malformed hands, poorly drawn hands, bad hand structure, extra digits, fewer digits, extra fingers, fused fingers, bad leg, extra leg, distorted composition, bad perspective, multiple views, disorganized colors, unrealistic colors, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, subpar, poor, blurry, lowres, duplicate, worst quality, bad quality, messy details, fewer details, bad portrait, bad illustration, awkward, bad posture, artist:milkpanda, artist:khyle., artist:bkub, 1.4::resized, upscaled, downscaled,colored sclera, blush::
```

---

## 5. 4.5F 그림체 모음 (커뮤니티)

> **출처:** [아카라이브 AI 그림채널 — 4.5F 그림체 모음집](https://arca.live/b/aiart/160585885) by 영국
>
> **공통 설정:** Model NAI 4.5F / Steps 28 / Variety+ off / Sampler k_euler_ancestral (karras)
>
> **💡 팁:** Prompt Guidance는 5~6으로 낮추는 편이 퀄리티 챙기기에 좋음.

### 공통 네거티브 (그림챈산)

대부분의 스타일(#1~#28, #35)이 공유하는 네거티브. 개별 스타일에 `[Neg: 그림챈산]`으로 표기.

```text
text, logo, watermark, too many watermarks, blank page, text-only page, reference, username, signature, xinzoruo, milkpanda, bkub, artist collaboration, variant set, large variant set, 4koma, 2koma, toon (style), oekaki, chibi, turnaround, film grain, monochrome, dithering, halftone, screentones, dated, old, 1990s (style), mutation, deformed, distorted, disfigured, artistic error, distorted anatomy, anatomical structure error, asymmetrical face, asymmetrical eyes, unnatural hair, bad eyes, cloudy eyes, blank eyes, pointy ears, bad proportions, bad limb, bad hands, extra hands, bad hand structure, extra digits, fewer digits, bad legs, extra legs, amputee, distorted composition, bad perspective, multiple views, negative space, animation error, chromatic aberration, disorganized colors, scan artifacts, jpeg artifacts, vertical lines, vertical banding, worst quality, bad quality, lowres, blurry, upscaled, fewer details, unfinished, incomplete, amateur, cheesy, unsatisfactory, inadequate, deficient, subpar, poor, displeasing, very displeasing, bad illustration, bad portrait
```

### 공통 네거티브 (별도 A)

일부 스타일(#2~#6, #21~#22)이 사용하는 네거티브. `[Neg: 별도A]`로 표기.

```text
artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page, blurry, displeasing, bad anatomy, bad perspective, bad proportions, bad aspect ratio, bad face, long face, bad teeth, bad neck, long neck, bad arm, bad hands, bad ass, bad leg, bad feet, bad reflection, bad shadow, bad link, bad source, wrong hand, wrong feet, missing limb, missing eye, missing tooth, missing ear, missing finger, extra faces, extra eyes, extra eyebrows, extra mouth, extra tongue, extra teeth, extra ears, extra breasts, extra arms, extra hands, extra legs, extra digits, fewer digits, cropped head, cropped torso, cropped shoulders, cropped arms, cropped legs, mutation, deformed, disfigured, unfinished, text, error, watermark, scan, mosaic, mosaic censoring, artist:bkub, dog, cat, artist name, futanari, hair intakes, out of frame, speech bubble, logo, artist logo
```

### 공통 네거티브 (그림챈산 변형)

스타일 #29~#34가 사용하는 확장 네거티브. `[Neg: 그림챈산변형]`으로 표기.

```text
negative space, blank page, text, logo, watermark, too many watermarks, reference, signature, artist name, subtitles, captions, dated, chibi, artistic error, scan artifacts, jpeg artifacts, aliasing, film grain, heavy film grain, dithering, chromatic aberration, digital dissolve, halftone, screentone, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist:bkub, artist collaboration, one-hour drawing challenge, 4koma, 2koma, mutated, mutation, deformed, distorted, disfigured, bad anatomy, unnatural hair, bad face, mob face, cloned face, distorted face, poorly drawn face, ugly, bad eyes, empty eyes, extra eyes, lazy eye, asymmetrical eyes, cross-eyed, bad proportions, wrong body proportions, unrealistic proportions, distorted body, long neck, wrong head size, bad limbs, missing limbs, extra limbs, amputee, bad arm, bad hands, malformed hands, poorly drawn hands, bad hand structure, extra digits, fewer digits, extra fingers, fused fingers, bad leg, extra leg, distorted composition, bad perspective, multiple views, disorganized colors, unrealistic colors, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, subpar, poor, blurry, lowres, duplicate, worst quality, bad quality, messy details, fewer details, bad portrait, bad illustration, awkward, bad posture
```

---

### [Style #01] Yamamoto Souichirou 기반
- **Guidance:** 7 | **Rescale:** 0.6 | **Neg:** 그림챈산 (+ sweat 추가)
- **비고:** 최애 그림체. Guidance 5~6 권장.
- **원글:** https://arca.live/b/aiart/148886526, https://arca.live/b/aiart/149597670
- **작태:** `1.2::artist:yamamoto souichirou ::, 0.7::artist:ciloranko ::, 1.0::artist:channel (caststation)::, 1.1::artist:ratatatat74 ::, 1.1::artist:gogalking ::, 0.5::artist:ohisashiburi::, 0.9::artist:kyo-hei (kyouhei)::,`
- **퀄리티:** `newest, year 2025, year 2024, -4::artist collaboration::, -3::simple illustration, jaggy lines, oekaki, multiple shots, unfinished, blurry, dead eyes, blank eyes::, 1.2::shiny skin, dot nose::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes,`

### [Style #02] Mori Taishi 기반
- **Guidance:** 7 | **Rescale:** 0.3 | **Neg:** 별도A
- **비고:** Guidance 5~6 권장.
- **원글:** https://arca.live/b/aiart/139439915
- **작태:** `0.1::style parody:danganronpa_(series)::, 0.2::artist:mizuryu kei::, 0.2::artist:ciloranko::, 0.7::artist:gogalking::, 0.7::artist:ratatatat74 ::, 1.0::artist:mameojitan::, 1.0::artist:mochizuki kei::, 1.2::artist:rifleman1130 ::, 1.5::artist:mori taishi::,`
- **퀄리티:** `year 2025, year 2024, depth of field, distinct image, volumetric lighting, no text, 1.2::masterpiece, masterpiece portrait, best quality, amazing quality, very aesthetic, extremely detailed, highres, absurdres, intricate details, hyper detail, finely detailed::, -3.0::blurry, unfinished, simple illustration::, -3.0::artist collaboration::,`

### [Style #03] Karlyn 기반 (No Lineart)
- **Guidance:** 8 | **Rescale:** 0 | **Neg:** 별도A
- **비고:** `3.0::jaggy lines, no lineart::, -4.0::flat color::` 화풍 태그가 핵심.
- **원글:** https://arca.live/b/aiart/139446115, https://arca.live/b/aiart/139485519
- **작태:** `0.7::artist:ciloranko::, 0.7::artist:gogalking::, 1.0::artist:karyln::, 1.0::artist:mizu cx::, 1.0::artist:quezify::, 1.0::artist:modare::, 1.2::artist:ask (askzy)::, 1.2::artist:ningen mame::, 1.5::artist:healthyman::, 3.0::jaggy lines, no lineart::, -4.0::flat color::,`
- **퀄리티:** `year 2025, year 2024, depth of field, distinct image, volumetric lighting, no text, 1.2::masterpiece, masterpiece portrait, best quality, amazing quality, very aesthetic, extremely detailed, highres, absurdres, intricate details, hyper detail, finely detailed::, -3.0::blurry, unfinished, simple illustration::, -3.0::artist collaboration::,`

### [Style #04] Rifleman1130 기반
- **Guidance:** 5 | **Rescale:** 0.2 | **Neg:** 별도A
- **원글:** https://arca.live/b/aiart/139628123
- **작태:** `1.2::artist:rifleman1130 ::, 1.2::artist:myabit::, 1.0::artist:shexyo::, 1.0::artist:gogalking::, 1.0::artist:do m kaeru::, 1.0::artist:mx2j::, 0.4::artist:tianliang duohe fangdongye::, 0.2::artist:dog-san::, 0.2::artist:ask (askzy)::,`
- **퀄리티:** `-3::artist collaboration::, year 2025, year 2024, no text, -1.0::multiple views::, 1.2::best quality, very aesthetic, absurdres::, masterpiece, no text,`

### [Style #05] Myabit / Ohisashiburi 기반
- **Guidance:** 6 | **Rescale:** 0 | **Neg:** 별도A
- **원글:** https://arca.live/b/aiart/139713929, https://arca.live/b/aiart/139795003
- **작태:** `0.2::artist:asanagi::, 0.5::artist:ahemaru::, 0.7::artist:ciloranko::, 0.7::artist:ningen mame::, 1.0::artist:gogalking::, 1.0::artist:hyulla::, 1.0::artist:beeeeen::, 1.5::artist:myabit::, 1.5::artist:ohisashiburi::,`
- **퀄리티:** `-3::artist collaboration::, year 2025, year 2024, no text, -1.0::multiple views::, 1.2::best quality, very aesthetic, absurdres::, masterpiece, no text,`

### [Style #06] Asura 기반 (입체감)
- **Guidance:** 5 | **Rescale:** 0.3 | **Neg:** 별도A
- **비고:** `-4.0::flat color, minimalism::` 으로 입체감 강조.
- **원글:** https://arca.live/b/aiart/139854243
- **작태:** `0.2::artist:mizuryu kei::, 0.5::artist:gogalking::, 0.5::artist:krekkov::, 0.5::artist:ciloranko::, 0.7::artist:wagash (dagashiya)::, 1.0::artist:j.k::, 1.0::artist:quasarcake::, 1.2::artist:mochizuki kei::, 1.5::artist:shexyo::, 1.8::artist:asura (asurauser)::, -4.0::flat color, minimalism::,`
- **퀄리티:** `-3::artist collaboration::, year 2025, year 2024, no text, -1.0::multiple views, upscaled::, 1.2::best quality, very aesthetic, absurdres::, masterpiece, no text,`

### [Style #07] 제갈량 딸내미 (Ohisashiburi 기반)
- **Guidance:** 5.5 | **Rescale:** 0.2 | **Neg:** 별도A (확장판)
- **비고:** 캐릭터 작화 최고이나 배경 퀄리티 한계. `-4.0::flat color, minimalism::` 포함.
- **원글:** https://arca.live/b/aiart/140099892, https://arca.live/b/aiart/140122805
- **작태:** `0.3::artist:ask (askzy)::, 0.5::artist:noyu (noyu23386566)::, 0.6::artist:ratatatat74 ::, 0.7::artist:john kafka::, 0.8::artist:rei (sanbonzakura)::, 1.2::artist:gogalking::, 1.3::aritst:magotsuki (hurray)::, 1.5::artist:ohisashiburi::, -4.0::flat color, minimalism::,`
- **퀄리티:** `year 2025, year 2024, no text, -1::multiple views, upscaled, blurry, bad hands, undetailed hands, bad anatomy::, detailed eyes, detailed hands, perfect anatomy, depth of field, volumetric lighting, masterpiece, best quality, very aesthetic, absurdres,`

### [Style #08] Gogalking / Mika Pizako 기반
- **Guidance:** 7.5 | **Rescale:** 0.6 | **Neg:** 그림챈산 (+ sweat 추가)
- **원글:** https://arca.live/b/aiart/148193553
- **작태:** `0.7::artist:blackbox (blackbox9158) ::, 0.9::artist:sukja ::, 1.3::artist:haragaita i ::, 1.0::artist:rei (sanbonzakura) ::, 1.5::artist:mika pizako ::, 1.0::artist:myabit ::, 1.0::artist:kim eb ::, 1.1::artist:starshadowmagician ::, 2.0::artist:gogalking ::, 1.4::artist:wanke ::, 1.3::artist:yoneyama mai ::,`
- **퀄리티:** `newest, year 2025, year 2024, -3::simple illustration, jaggy lines, oekaki, multiple shots, artist collaboration, unfinished::, 2::shiny skin::, 3.45::official style, pixiv commission::, vivid details, soft shading, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration,`

### [Style #09] Channel (Caststation) / Rurudo 기반
- **Guidance:** 7 | **Rescale:** 0.4 | **Neg:** 그림챈산
- **비고:** 깎다가 중단한 그림체.
- **원글:** https://arca.live/b/aiart/149171287 (야짤 주의)
- **작태:** `1.2::artist:channel (caststation) ::, 0.3::artist:quasarcake ::, 1.0::artist:gogalking ::, 0.6::artist:rurudo ::, 0.5::artist:nyte tyde ::, 0.8::artist:john kafka ::, 0.7::artist:dishwasher1910 ::, 0.4::artist:seapall ::,`
- **퀄리티:** `newest, year 2025, year 2024, -3::simple illustration, multiple shots, artist collaboration, unfinished, dead eyes, blank eyes::, 1.2::shiny skin, dewy skin::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes,`

### [Style #10] 순정만화 1 (Ao 기반)
- **Guidance:** 7 | **Rescale:** 0.4 | **Neg:** 그림챈산
- **원글:** https://arca.live/b/aiart/149298045 (야짤 주의)
- **작태:** `1.2::artist:ratatatat74 ::, 0.4::artist:quasarcake ::, 0.8::artist:ciloranko ::, 0.9::artist:channel (caststation) ::, 0.7::artist:mika pizako ::, 1.5::artist:ao (ao0 0nemu) ::, 0.6::artist:qiandaiyiyu ::, 0.5::artist:noyu (noyu23386566) ::, 0.2::artist:blackbox (blackbox9158) ::,`
- **퀄리티:** `newest, year 2025, year 2024, -3::simple illustration, jaggy lines, oekaki, multiple shots, artist collaboration, unfinished, dead eyes, blank eyes::, 1.2::shiny skin::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes,`

### [Style #11] 순정만화 2 (Gogalking + Ao)
- **Guidance:** 7 | **Rescale:** 0.6 | **Neg:** 그림챈산
- **원글:** https://arca.live/b/aiart/149508889 (야짤 주의)
- **작태:** `1.2::artist:gogalking ::, 0.6::artist:qiandaiyiyu ::, 0.4::artist:quasarcake ::, 0.8::artist:ciloranko ::, 0.9::artist:channel (caststation) ::, 0.7::artist:mika pizako ::, 1.5::artist:ao (ao0 0nemu) ::, 0.5::artist:noyu (noyu23386566) ::, 0.2::artist:blackbox (blackbox9158) ::,`
- **퀄리티:** `newest, year 2025, year 2024, -4::artist collaboration::, -3::simple illustration, jaggy lines, oekaki, multiple shots, unfinished, blurry, dead eyes, blank eyes::, 1.2::shiny skin::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes,`

### [Style #12] Starshadowmagician 기반
- **Guidance:** 7 | **Rescale:** 0.6 | **Neg:** 그림챈산
- **비고:** 막짤 기준(텍스트 상의 데이터)이 가장 잘 뽑힘.
- **원글:** https://arca.live/b/aiart/151708495 (야짤 주의)
- **작태:** `0.6::artist:wanke ::, 1.0::artist:dishwasher1910 ::, 0.9::artist:ratatatat74 ::, 0.8::artist:blackbox (blackbox9158) ::, 0.5::artist:sukja ::, 1.2::artist:hanaseto ::, 0.7::artist:others (gogo-o) ::, 0.4::artist:aoseagrass ::, 1.5::artist:starshadowmagician ::,`
- **퀄리티:** `newest, year 2025, year 2024, -4::artist collaboration::, -3::simple illustration, jaggy lines, oekaki, multiple shots, unfinished, blurry, dead eyes, blank eyes, blush stripes::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes,`

### [Style #13] Karyln / Rusellunt 기반
- **Guidance:** 7 | **Rescale:** 0.4 | **Neg:** 그림챈산
- **비고:** shiny skin은 빼도 무방. 물광찌찌 취향 시 유지.
- **원글:** https://arca.live/b/aiart/157302028
- **작태:** `1.21::artist:karyln::, 1.03::artist:ohisashiburi::, 1.29::artist:rusellunt::, 1.0::artist:modare::, 0.98::artist:ningen mame::, 0.97::artist:john kafka::, 0.69::artist:kim hyung tae::, 0.65::artist:gogalking::, 0.21::artist:qiandaiyiyu::,`
- **퀄리티:** `newest, year 2025, year 2024, newest, year 2025, year 2024, -4::artist collaboration ::, -3::simple illustration, multiple shots, unfinished, blurry, dead eyes, blank eyes ::, 3::official style, pixiv commission, shiny skin::, perfect anatomy, highly finished, amazing quality, best quality, masterpiece, very aesthetic, absurdres, best illustration, beautiful eyes,`

### [Style #14] Sapysha 기반
- **Guidance:** 7 | **Rescale:** 0.6 | **Neg:** 그림챈산
- **원글:** https://arca.live/b/aiart/157250526
- **작태:** `1.68::artist:sapysha ::, 1.18::artist:ratatatat74 ::, 1.01::artist:rusellunt ::, 0.97::artist:abae ::, 0.96::artist:gemi ningen ::, 0.68::artist:hiita (hitta 99) ::, 0.38::artist:yamamoto souichirou::, newest, year 2025, year 2024,`
- **퀄리티:** `-3::artist collaboration, simple illustration, jaggy lines, oekaki, multiple shots, unfinished, blurry, dead eyes, blank eyes::, 1.2::shiny skin, dot nose::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes,`

### [Style #15] Mori Taishi / Liduke 기반 (3D)
- **Guidance:** 7 | **Rescale:** 0.5 | **Neg:** 그림챈산
- **비고:** `3d` 태그 포함, `-1::blurry, flat color, dead eyes, blank eyes::`.
- **원글:** https://arca.live/b/aiart/157445826
- **작태:** `1.3::artist:mori taishi::, 1.2::artist:mameojitan::, 1.11::artist:ratatatat74 ::, 1.1::artist:gogalking::, 1.0::artist:liduke::, 0.9::artist:modare::, 0.8::artist:izuru (timbermetal)::, 0.3::artist:ciloranko::, 0.2::artist:mizuryu kei::,`
- **퀄리티:** `year 2025, year 2024, newest, -4::artist collaboration ::, -3::simple illustration, multiple shots, unfinished::, -1::blurry, flat color, dead eyes, blank eyes::, 3d, 3::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes,`

### [Style #16] Modare / Ssambatea 기반 (3D Game CG)
- **Guidance:** 7 | **Rescale:** 0.2 | **Neg:** 그림챈산
- **비고:** `1.5::3d::`, `1.2::game cg::`, `rating:explicit` 포함.
- **원글:** https://arca.live/b/aiart/157541705
- **작태:** `1.1::artist:ratatatat74 ::, .85::artist:nyte tyde::, 1.2::artist:try (lsc)::, 1.1::artist:sho (sho lwlw)::, 1::artist:ask (askzy)::, 1.8::artist:modare::, 1.05::artist:henriiku (ahemaru) ::, .8::artist:reoen::, 1.75::artist:ssambatea::, .75::artist:wanke::, .9::artist:yamamoto souichirou::, .7::artist:dishwasher1910 ::, .65::artist:ningen mame::, .6::artist:kim hyung tae::,`
- **퀄리티:** `2::official art::, ai-generated, shiny skin, detailed background, depth of field, volumetric lighting, 1.5::3d::, rating:explicit, 1.2::game cg::, year 2024, year 2025, highly detailed, detailed, masterpiece, best quality, very aesthetic, highres, best illustration, no text, -2::reference sheet, multiple shots, simple illustration, censored, dithering, sweat, negative space, dead eyes::, -3::artist collaboration::,`

### [Style #17] Yamamoto + Kawacy 기반
- **Guidance:** 7 | **Rescale:** 0.4 | **Neg:** 그림챈산
- **원글:** https://arca.live/b/aiart/157639572
- **작태:** `1.5::artist:yamamoto souichirou::, 1::artist:channel (caststation)::, 1.1::artist:gogalking ::, .9::artist:ratatatat74 ::, .7::artist:ohisashiburi::, .8::artist:john kafka::, .6::artist:wanke::, 1.4::artist:kawacy::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, unfinished, jaggy lines, dead eyes::, detailed background, beautiful eyes, 2::official art, commission, best illustration::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #18] Rolua / Qys3 기반 (야짤 전용)
- **Guidance:** 7 | **Rescale:** 0.2 | **Neg:** 그림챈산
- **원글:** https://arca.live/b/aiart/157704631, https://arca.live/b/aiart/157713216 (야짤 주의)
- **작태:** `1.4::artist:rolua::, 1.3::artist:ohisashiburi::, 1.2::artist:qys3 ::, 1.1::aritst:tekito midori::, 1.0::aritst:sheya::, 0.9::artist:dishwasher1910 ::, 0.75::artist:kawacy::, 0.7::artist:kupa (jesterwii)::, 0.65::artist:channel (caststation)::, 0.6::artist:anmi::, 0.5::artist:tianliang duohe fangdongye::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, unfinished, dead eyes::, detailed background, beautiful eyes, 2::official art, commission, best illustration::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #19] K.Pumpkin / Shinkai Makoto 기반
- **Guidance:** 7 | **Rescale:** 0.2 | **Neg:** 그림챈산
- **원글:** https://arca.live/b/aiart/157704631
- **작태:** `1.5::artist:k.pumpkin::, 1.3::artist:mori taishi::, 1.2::artist:kkuem::, 1.1::artist:torino aqua::, 1.0::artist:danimaru::, 0.95::artist:shinkai makoto::, 0.9::artist:channel (caststation)::, 0.8::artist:ohisashiburi::, 0.7::artist:ask (askzy)::, 0.6::artist:ratatatat74 ::, 0.3::artist:au (d elete)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, unfinished, dithering, dead eyes::, detailed background, beautiful eyes, 2::official art, commission, best illustration::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #20] 말랑이 (Yueepon / Kenkou Cross)
- **Guidance:** 7 | **Rescale:** 0.6 | **Neg:** 그림챈산
- **원글:** https://arca.live/b/aiart/157786665
- **작태:** `1.8::artist:yueepon::, 1.7::artist:dishwasher1910 ::, 1.5::artist:33 gaff::, 1.3::artist:kenkou cross ::, 1::artist:ssambatea::, .9::artist:ratatatat74 ::, .85::artist:ciloranko::, .8::artist:wanke::, .7::artist:rurudo::, .6::artist:channel (caststation)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #21] 말랑이 파생 (Dishwasher1910 메인)
- **Guidance:** 7 | **Rescale:** 0.6 | **Neg:** 별도A
- **비고:** Style #20 파생. 이미 캐챗 제작자 사용 중.
- **원글:** https://arca.live/b/aiart/157789106
- **작태:** `1.7::artist:dishwasher1910 ::, 1.5::artist:33 gaff::, 1.3::artist:kenkou cross ::, 1.2::artist:yueepon::, 1::artist:ssambatea::, .9::artist:ratatatat74 ::, .85::artist:ciloranko::, .8::artist:wanke::, .7::artist:rurudo::, .6::artist:channel (caststation)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #22] Kishida Mel 기반 (눈 예쁨)
- **Guidance:** 6 | **Rescale:** 0.7 | **Neg:** 별도A
- **비고:** 눈이 예쁜 그림체. 개선 예정.
- **원글:** https://arca.live/b/aiart/157904611
- **작태:** `1.4::artist:kishida mel::, 1.3::artist:myabit ::, 1.2::artist:gogalking::, 1.1::artist:kawacy::, 1::artist:reoen::, 0.9::artist:wanke::, 0.8::artist:channel (caststation) ::, 0.5::artist:fajyobore::, 0.4::artist:quasarcake::, 0.7::artist:healthyman::,`
- **퀄리티:** `year 2025, year 2024, newest, -6::artist collaboration, simple illustration, multiple shots::, detailed background, 2::official art, commission, best illustration, game cg, depth of field::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, no text,`

### [Style #23] Lam (Ramdayo) 기반
- **Guidance:** 6 | **Rescale:** 0.6 | **Neg:** 그림챈산
- **비고:** `au (d elete)` 태그는 선택. 넣으면 분위기 변화.
- **원글:** https://arca.live/b/aiart/157904772
- **작태:** `1.4::artist:lam (ramdayo)::, 1.3::artist:ohisashiburi::, 1.2::artist:mebaru::, 1::artist:channel (caststation)::, 0.8::artist:yamamoto souichirou::, 0.7::artist:mameojitan::, 0.6::artist:abandon ranka::, 0.5::artist:gogalking::, 0.4::artist:iuui::, 0.2::artist:spacezin::, 0.1::artist:au (d elete)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots::, detailed background, 2::official art, commission, best illustration, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #24] 적과 백 (Gogalking / John Kafka)
- **Guidance:** 6 | **Rescale:** 0.6 | **Neg:** 그림챈산
- **비고:** 캐챗 <적과 백>의 그림체. `dot nose` 태그는 선택.
- **원글:** https://arca.live/b/aiart/157905220
- **작태:** `1.7::artist:gogalking::, 1.5::artist:ratatatat74 ::, 1.2::artist:rsef::, 1.1::artist:ask (askzy)::, 1::artist:modare::, 0.8::artist:hwansang::, 0.6::artist:channel (caststation)::, 0.5::artist:wlop ::, 0.1::artist:au (d elete)::, 1.4::artist:john kafka::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, game cg, depth of field, dot nose ::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #25] Love Cacao / Joosibi 기반
- **Guidance:** 6 | **Rescale:** 0~0.2 | **Neg:** 그림챈산
- **비고:** `pottsness` 태그는 선택. 넣으면 분위기 변화.
- **원글:** https://arca.live/b/aiart/157930550
- **작태:** `1.5::artist:love cacao::, 1.2::artist:au (d elete)::, 1.0::artist:nixeu::, 1.05::artist:dishwasher1910 ::, 0.94::artist:yoneyama mai::, 1.1::artist:wanke::, 0.98::artist:mochizuki kei::, 0.67::artist:ohisashiburi::, 0.8::artist:liduke::, 1.15::artist:joosibi::, 0.8::artist: 96yottea::, 0.3::artist:pottsness::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots::, detailed background, shiny skin, 2::official art, commission, best illustration, depth of field, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #26] Rusellunt 기반 (Style #01 개선)
- **Guidance:** 6 | **Rescale:** 0.5 | **Neg:** 그림챈산
- **비고:** Style #01(최애)의 개선 시도. 결과물이 달라졌지만 나쁘지 않음.
- **원글:** https://arca.live/b/aiart/157964783
- **작태:** `1.5::artist:rusellunt ::, 1.1::artist:yamamoto souichirou::, 1.0::artist:gogalking::, 0.95::artist:kim hyung tae::, 0.9::artist:k.pumpkin::, 0.85::artist:kishida mel::, 0.8::artist:ask (askzy)::, 0.75::artist:wagashi (dagashiya)::, 0.6::artist:magotsuki (hurray)::, 0.5::aritst:shinkai makoto::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, shiny skin, 2::official art, commission, best illustration, depth of field, game cg, dot nose::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed,`

### [Style #27] 까탸 전용 (122pxsheol 기반)
- **Guidance:** 6 | **Rescale:** 0.5 | **Neg:** 그림챈산
- **원글:** https://arca.live/b/aiart/158048582
- **작태:** `1.2::artist:122pxsheol::, 1.1::aritst:ohisashiburi::, 1::artist:oharu-chan::, 0.9::artist:mameojitan::, 0.8::artist:dorontabi::, 0.7::artist:ciloranko::, 0.6::artist:quasarcake ::, 0.4::artist:noyu (noyu23386566)::, 0.3::artist:channel (caststation)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, dead eyes::, detailed background, depth of field, 2::official art, commission, best illustration::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #28] Namori 기반 (동그란 눈)
- **Guidance:** 6 | **Rescale:** 0.1 | **Neg:** 그림챈산
- **비고:** 눈 동그랗게 그리는 작가 총출동.
- **원글:** https://arca.live/b/aiart/158087049
- **작태:** `1.5::artist:namori::, 1.1::artist:channel (caststation)::, 1.0::artist:ohisashiburi::, .9::artist:modare::, .8::artist:noyu (noyu23386566)::, .7::artist:gogalking::, 0.6::artist:yamamoto souichirou::, .5::artist:122pxsheol::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, atmospheric perspective, depth of field, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #29] Channel (Caststation) 메인
- **Guidance:** 6 | **Rescale:** 0.5 | **Neg:** 그림챈산변형
- **원글:** https://arca.live/b/aiart/158167591
- **작태:** `2::artist:channel (caststation)::, 1.5::artist:ratatatat74 ::, 1.2::artist:ebora::, 1.1::artist:yoneyama mai::, 1::artist:baffu::, .9::artist:haguhagu (rinjuu circus)::, .8::artist:myabit::, .7::artist:eonsang::, .6::artist:nagi itsuki::, .5::artist:henriiku (ahemaru)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration::, detailed background, shiny skin, 2::depth of field, official art, commission, best illustration::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #30] 제갈량 딸내미 리마스터 (Ohisashiburi)
- **Guidance:** 6 | **Rescale:** 0.2 | **Neg:** 그림챈산변형
- **원글:** https://arca.live/b/aiart/158232422
- **작태:** `1.5::artist:ohisashiburi::, 1.2::artist:john kafka::, 1.1::artist:secretfj520, artist:mameojitan::, 1::artist:magotsuki (hurray)::, .9::artist:modare::, .8::artist:ssambatea, artist:ask (askzy)::, .7::artist:chooco (chocoshi)::, .3::artist:channel (caststation)::, .6::artist:noyu (noyu23386566)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, depth of field::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #31] 6 (Yuchae) / Maccha 기반
- **Guidance:** 6 | **Rescale:** 0.3 | **Neg:** 그림챈산변형
- **원글:** https://arca.live/b/aiart/158331941
- **작태:** `1.6::artist:6 (yuchae)::, 1.3::artist:yueepon::, 1.1::artist:channel (caststation)::, 1::artist:maccha (mochancc)::, .9::artist:gogalking::, .8::artist:ratatatat74, artist: chooco (chocoshi)::, .7::artist:wanke::, .5::artist:rurudo::, .6::artist:dishwasher1910 ::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, depth of field, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #32] Sushio 기반
- **Guidance:** 6 | **Rescale:** 0.5 | **Neg:** 그림챈산변형
- **원글:** https://arca.live/b/aiart/158540869
- **작태:** `1.5::artist:sushio::, 1.2::artist:magotsuki (hurray)::, 1.1::artist:secretfj520, artist:channel (caststation)::, 1::artist:ratatatat74, artist:john kafka::, .9::artist:gogalking::, .8::artist:ssambatea, artist:ask (askzy)::, .5::artist:noyu (noyu23386566)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, game cg, depth of field::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #33] Arisaka Ako / Yumi Xsh 기반
- **Guidance:** 6 | **Rescale:** 0.5~0.6 | **Neg:** 그림챈산변형
- **비고:** chooco (chocoshi)는 배경의 신!
- **원글:** https://arca.live/b/aiart/158221074
- **작태:** `1.6::artist:arisaka ako::, 1.3::artist:yumi xsh::, 1.1::artist:haihaiera::, 1::artist:yoneyama mai::, .9::artist:secretfj520 ::, .7::artist:pigeon666 ::, .6::artist:33gaff:: .5::artist:john kafka, artist:chooco (chocoshi)::, .8::artist:gogalking::, .7::artist:channel (caststation)::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, dead eyes::, detailed background, 2::depth of field, official art, commission, best illustration, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #34] Yoneyama Mai 기반 (배경 원툴)
- **Guidance:** 5 | **Rescale:** 0.3~0.5 | **Neg:** 그림챈산변형
- **비고:** 배경 퀄리티가 강점.
- **원글:** https://arca.live/b/aiart/158132349
- **작태:** `1.5::artist:yoneyama mai::, 1.1::artist:john kafka::, 1::artist:gogalking::, .9::artist:wlop, artist:maeka (kumaekake), artist:ohisashiburi::, .8::artist:ssambatea::, .7::artist:nagi itsuki, artist:chooco (chocoshi)::, .6::artist:sanshoku dango (shukosuko)::, .5::artist:channel (caststation), artist:nengoro::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, dead eyes::, detailed background, 2::offcial art, commission, best illustration, atmospheric perspective, depth of field::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text,`

### [Style #35] Arisaka Ako 확장 (제작 중)
- **Guidance:** 5 | **Rescale:** 0.5 | **Neg:** 그림챈산
- **비고:** 제작 중인 그림체.
- **작태:** `1.4::artist:arisaka ako::, 1.3::artist:yumi xsh::, 1.2::artist:channel (caststation)::, 1.1::artist:haihaiera::, 1::artist:yoneyama mai::, .9::artist:secretfj520, artist:nengoro::, .7::artist:pigeon666 ::, .6::artist:33gaff:: .5::artist:john kafka::, .7::artist:tokunaga akimasa, artist:chooco (chochoshi), artist:void 0, artist:wlop, artist:fjsmu::, .8::artist:gogalking::,`
- **퀄리티:** `year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, 2::depth of field, official art, commission, best illustration, game cg, detailed hands::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, no text,`

---

## 6. SDXL 스타일 (NAI 3 / Stable Diffusion XL)

> **주의:** 아래 스타일은 NAI SDXL 모델 전용. 4.5F와 프롬프트 문법이 다름 (`{{}}` 강조 / `[[]]` 약화).

### [SDXL Style 01] wlop × milkychu — 리얼리스틱 한국풍
- **Steps:** 28 | **CFG:** 5.0 | **Sampler:** k_dpmpp_sde | **Noise Schedule:** native
- **특징:** 사실적 질감, 한국인 피부톤, 광택감 있는 피부, 사진 느낌 라이팅. `milkychu`가 한국풍 얼굴형, `wlop`이 시네마틱 라이팅 담당.
- **출처:** 나무위키 이미지 메타데이터 추출
- **작태:** `{{{{wlop}}}}, [[[[[[asakuraf]]]]]], [ebifurya], [[pottsness]], [mikozin], [[[[mignon]]]], {{{{milkychu}}}},`
- **퀄리티:** `{{realistic, korean}}, photo (medium), year 2023, {{{best quality, amazing quality, highres, very aesthetic, detailed, uncensored}}}, {{{good hands}}},`
- **네거티브:** `lowres, bad anatomy, bad hands, extra digits, fewer digits, worst quality, low quality, blurry, deformed face, asymmetric eyes, extra fingers, ugly, disfigured, extra limbs, missing limbs, animal ears, tail, bad eyes, crossed eyes, empty eyes, unfocused eyes`
- **권장 해상도:** 1280 × 1856 (세로)
