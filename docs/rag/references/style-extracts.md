# 화풍 메타데이터 추출 레퍼런스

커뮤니티 AI 이미지에서 추출한 화풍 정보 누적 문서.

---

### #1 — 아카라이브 aiart 반실사 게임CG풍
- **출처**: https://arca.live/b/aiart/168288257
- **추출일**: 2026-04-23
- **Model**: NAI V4.5 Full
- **Scale**: 5.0 | **Steps**: 28 | **Sampler**: k_dpmpp_2m_sde
- **CFG Rescale**: 0.4

**Artist 태그:**
```
1.7::artist:kim eb::, 0.7::artist:qiandaiyiyu::, 0.3::artist:sos adult::, 1.1::artist:yunsang::, 0.2::artist:freng::, 1.4::artist:torino aqua::, 0.8::artist:piratescat01::, 1.6::artist:wanke::, 0.4::artist:quasarcake, artist:cutesexyrobutts, artist:aya shobon::
```

**스타일 태그:**
```
4::photorealistic, realistic::, 2::3d, blender (medium)::
```

**Quality:**
```
prefix: 10::high detail::, 0.06::aesthetic::, 0.01::detailed::, ultra detailed, highres, incredibly absurdres
suffix: 3::masterpiece, best quality, high quality, amazing quality, very aesthetic::, best illustration, novel illustration
extra: uncensored, detailed eyes, 1.2::detailed pupils::, silky skin, detailed skin texture
```

**네거티브 (핵심):**
```
artist:xinzoruo, artist:milkpanda, 0.4::artist:nameo (judgemasterkou), artist:matsunaga kouyou::
-4::artist collaboration::
1.5::skintight, tight fit, tight clothes, form fitting, bodypaint, body hugging, leotard::
western fantasy, armor, heavy fabric, opaque clothes
```

**캐릭터 태그 (V4 char caption):** `3::mature female::, gigantic breasts, wide hips, 0.3::inverted nipples::`
**특이사항:**
- Scale 5.0 (일반적인 6보다 낮음) + CFG Rescale 0.4 조합
- Sampler가 k_dpmpp_2m_sde (일반적인 k_dpmpp_2m 아님)
- `4::photorealistic, realistic::` 반실사 강조
- `10::high detail::` 극강 디테일
- 네거티브에 특정 아티스트를 지정하여 원치 않는 화풍 배제
- V4 char caption으로 체형을 별도 지정

---

### #2 — 아카라이브 flat color 스케치풍 (kitagawa marin)
- **출처**: https://ac-o.namu.la/20260301sac/e0e2d7b15aac1e6c5b44497d2157685af0d17ab4eaeb796b91fd3bebe9b7cf5e.png
- **추출일**: 2026-04-23
- **Model**: NAI V4.5 Full (4BDE2A90)
- **Scale**: 6.0 | **Steps**: 28 | **Sampler**: k_euler_ancestral
- **CFG Rescale**: 0.4
- **Noise Schedule**: karras
- **Skip CFG Above Sigma**: 58.0

**Artist 태그:**
```
0.6::artist:blue gk, artist:qiandaiyiyu::, 1.2::artist:rei_(sanbonzakura), artist:dishwasher1910, artist:mx2j::, 1.3::artist:ratatatat74::, 0.4::artiat:mimyo, artist:sohn woohyoung::, 0.6::artist:ask_(askzy)::
```

**스타일 태그:**
```
3::flat color::, sketch
```

**Quality:**
```
prefix: high detail, masterpiece, best quality, very aesthetic, highres, best illustration
negative emphasis: -3::simple illustaration, multiple views, monochrome, censored::, solo artist, -5.3::artist collaboration::
```

**네거티브 (핵심):**
```
artist:xinzoruo, artist:milkpanda, artist:kurukurumagical
artist collaboration, one-hour drawing challenge, toon (style), 1990s (style), 4koma, 2koma
(+ 표준 NAI 품질 네거티브)
```

**캐릭터 태그 (V4 char caption):** `girl, kitagawa marin,`
**특이사항:**
- `3::flat color::, sketch` 조합으로 플랫컬러 스케치 화풍 강조
- Sampler가 k_euler_ancestral (#1의 k_dpmpp_2m_sde와 다름)
- `skip_cfg_above_sigma: 58.0` 사용 (노이즈 높은 구간 CFG 스킵)
- `artiat:mimyo` — 오타로 보이나 원문 그대로 기록
- ratatatat74 가중치 1.3으로 가장 높음 — 이 아티스트의 화풍이 지배적
- #1과 artist:qiandaiyiyu 공통 사용

---

### #3 — 아카라이브 aiart 세미리얼 일러스트 (흑발 안경 소녀)
- **출처**: https://arca.live/b/aiart/160585885
- **추출일**: 2026-04-23
- **Model**: NAI V4.5 (추정)
- **Scale**: 5.0 | **Steps**: 28 | **Sampler**: k_euler_ancestral
- **CFG Rescale**: 0.3
- **Noise Schedule**: karras

**Artist 태그:**
```
2.4::artist:liu2e3ing::, artist:ie (raarami)::, 0.7::artist:kunaboto::, 1.7::artist:yogisya::, 1.5::artist:dang0 23, artist:hito komoru::, 0.6::artist:beeeeen::, 2::artist:h@ll, artist:chen shu fen::, artist:kazuho iwamoto, artist:naohiro ito
```

**스타일 태그:**
```
photo (medium), blender (medium)
```

**Quality:**
```
prefix: best illustration, year 2024, year 2025
negative emphasis: -3::simple illustration::, -1::censored::, -6::artist collaboration::
ADD QUALITY TAG: TRUE (NAI 기본 품질 태그 자동 추가)
```

**네거티브 (전문):**
```
negative space, blank page, logo, too many watermarks, reference, subtitles, captions, dated, chibi, artistic error, aliasing, film grain, heavy film grain, dithering, digital dissolve, halftone, screentone, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist collaboration, one-hour drawing challenge, 4koma, 2koma, mutated, distorted, distorted face, poorly drawn face, ugly, bad eyes, empty eyes, extra eyes, lazy eye, asymmetrical eyes, cross-eyed, wrong body proportions, unrealistic proportions, distorted body, wrong head size, bad limbs, missing limbs, extra limbs, amputee, bad arm, malformed hands, poorly drawn hands, bad hand structure, fused fingers, bad leg, extra leg, distorted composition, bad perspective, multiple views, disorganized colors, unrealistic colors, incomplete, unsatisfactory, inadequate, deficient, subpar, poor, messy details, fewer details, bad portrait, normal quality, bad quality, low quality, worst quality, lowres, displeasing, very displeasing, 1.05::bad::, bad anatomy, bad hands, text, error, missing, missing finger, missing fingers, wrong hands, extra, extra digits, fewer, fewer digits, cropped, JPEG artifacts, signature, watermark, username, blurry, artist name, bad face, fat, duplicate, mutation, deformed, disfigured, extra arms, extra legs, long neck, bad feet, bad proportions, fewer, unfinished, chromatic aberration, scan, scan artifacts, character doll, nesoberi, furry, cat ears, animal ears, furry ears, split screen, 1.05::breast ptosis::, 1.16::variant set::, 1.16::large variant set::, bad illustration, mob face, cloned face, unnatural hair, wrong hands
```

**캐릭터 태그:** 없음 (범용)
**특이사항:**
- `2.4::artist:liu2e3ing::` 최고 가중치 — 핵심 화풍
- `2::artist:h@ll, artist:chen shu fen::` 두 번째 — 동양적 세미리얼 느낌
- Scale 5.0 (#1과 동일, 낮은 편) + CFG Rescale 0.3 (#1의 0.4보다 낮음)
- `photo (medium), blender (medium)` — 반실사 3D 느낌 (하지만 #1의 `4::photorealistic::` 보다 약함)
- ADD QUALITY TAG: TRUE — NAI 프리셋 품질 태그 자동 추가 사용
- 네거티브에 `1.05::breast ptosis::`, `1.16::variant set::` 등 세밀한 가중치 제어
- 네거티브에 `furry, cat ears, animal ears` — 수인/동물귀 방지
- #1, #2와 공통: `artist:xinzoruo, artist:milkpanda, artist:kurukurumagical` 네거티브

---

### #4 — 아카라이브 "영국" NAI V4.5F 화풍 컬렉션 (35종)
- **출처**: https://arca.live/b/aiart/160585885
- **추출일**: 2026-04-23
- **Model**: NAI V4.5 Full (전체 공통)
- **Steps**: 28 | **Sampler**: k_euler_ancestral (karras) (전체 공통)
- **Variety+**: off
- **라이선스**: 자유 사용/수정/재배포 가능 (작성자 명시)
- **작성자 팁**: 언더스코어(`_`)는 노이즈 증가시키므로 제거 권장. Prompt Guidance는 5~6이 퀄리티에 좋음.

#### 공통 네거티브 프롬프트

<details>
<summary><strong>네거티브A (그림챈산)</strong></summary>

```
text, logo, watermark, too many watermarks, blank page, text-only page, reference, username, signature, xinzoruo, milkpanda, bkub, artist collaboration, variant set, large variant set, 4koma, 2koma, toon (style), oekaki, chibi, turnaround, film grain, monochrome, dithering, halftone, screentones, dated, old, 1990s (style), mutation, deformed, distorted, disfigured, artistic error, distorted anatomy, anatomical structure error, asymmetrical face, asymmetrical eyes, unnatural hair, bad eyes, cloudy eyes, blank eyes, pointy ears, bad proportions, bad limb, bad hands, extra hands, bad hand structure, extra digits, fewer digits, bad legs, extra legs, amputee, distorted composition, bad perspective, multiple views, negative space, animation error, chromatic aberration, disorganized colors, scan artifacts, jpeg artifacts, vertical lines, vertical banding, worst quality, bad quality, lowres, blurry, upscaled, fewer details, unfinished, incomplete, amateur, cheesy, unsatisfactory, inadequate, deficient, subpar, poor, displeasing, very displeasing, bad illustration, bad portrait
```
</details>

<details>
<summary><strong>네거티브B (그림챈산변형)</strong></summary>

```
negative space, blank page, text, logo, watermark, too many watermarks, reference, signature, artist name, subtitles, captions, dated, chibi, artistic error, scan artifacts, jpeg artifacts, aliasing, film grain, heavy film grain, dithering, chromatic aberration, digital dissolve, halftone, screentone, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist:bkub, artist collaboration, one-hour drawing challenge, 4koma, 2koma, mutated, mutation, deformed, distorted, disfigured, bad anatomy, unnatural hair, bad face, mob face, cloned face, distorted face, poorly drawn face, ugly, bad eyes, empty eyes, extra eyes, lazy eye, asymmetrical eyes, cross-eyed, bad proportions, wrong body proportions, unrealistic proportions, distorted body, long neck, wrong head size, bad limbs, missing limbs, extra limbs, amputee, bad arm, bad hands, malformed hands, poorly drawn hands, bad hand structure, extra digits, fewer digits, extra fingers, fused fingers, bad leg, extra leg, distorted composition, bad perspective, multiple views, disorganized colors, unrealistic colors, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, subpar, poor, blurry, lowres, duplicate, worst quality, bad quality, messy details, fewer details, bad portrait, bad illustration, awkward, bad posture
```
</details>

#### 스타일 목록

| # | 이름 | PG | Rescale | 네거 | 비고 |
|---|------|-----|---------|------|------|
| 4-1 | Yamamoto Souichirou 기반 (최애) | 7 | 0.6 | A | 작성자 최애 그림체 |
| 4-2 | Mori Taishi 기반 | 7 | 0.3 | 별도 | - |
| 4-3 | Karlyn jaggy lines | 8 | 0 | 별도 | `3.0::jaggy lines, no lineart::` 핵심 |
| 4-4 | Rifleman1130 기반 | 5 | 0.2 | 별도 | - |
| 4-5 | Myabit/Ohisashiburi 기반 | 6 | 0 | 별도 | - |
| 4-6 | Shexyo/Asura 기반 | 5 | 0.3 | 별도 | `-4.0::flat color, minimalism::` |
| 4-7 | 제갈량 딸내미 | 5.5 | 0.2 | 별도(확장) | 캐릭터 작화 최강, 배경 한계 |
| 4-8 | Gogalking 2.0 기반 | 7.5 | 0.6 | A+sweat제거 | - |
| 4-9 | Channel (caststation) 기반 | 7 | 0.4 | A | - |
| 4-10 | Ao 순정만화 1 | 7 | 0.4 | A | 순정만화 분위기 시도 1 |
| 4-11 | 순정만화 2 | 7 | 0.6 | A | 순정만화 분위기 시도 2 |
| 4-12 | Starshadowmagician 기반 | 7 | 0.6 | A | - |
| 4-13 | Karyln/Rusellunt 기반 | 7 | 0.4 | A | shiny skin 선택적 |
| 4-14 | Sapysha 파인애플 | 7 | 0.6 | A | - |
| 4-15 | Mori Taishi 3d | 7 | 0.5 | A | `3d` 태그 + `-1::flat color::` |
| 4-16 | Game CG 3d | 7 | 0.2 | A | `1.5::3d::, 1.2::game cg::` 강조 |
| 4-17 | Kawacy 기반 | 7 | 0.4 | A | - |
| 4-18 | Rolua 기반 | 7 | 0.2 | A | - |
| 4-19 | K.pumpkin 새벽풍 | 7 | 0.2 | A | - |
| 4-20 | Yueepon 게임CG | 7 | 0.6 | A | - |
| 4-21 | 말랑이 (dishwasher1910 주도) | 7 | 0.6 | 별도(간결) | 이미 캐챗 제작자 사용 중 |
| 4-22 | Kishida Mel 기반 | 6 | 0.7 | 별도(간결) | 눈이 예쁨, `-6::` 매우 강한 네거 |
| 4-23 | Lam 기반 | 6 | 0.6 | A | `au (d elete)` 선택적 |
| 4-24 | John Kafka 기반 | 6 | 0.6 | A | `dot nose` 선택적, 캐챗 <적과 백> 사용 |
| 4-25 | Love Cacao 기반 | 6 | 0~0.2 | A | `pottsness` 선택적 |
| 4-26 | Rusellunt 개선 | 6 | 0.5 | A | 최애 그림체 개선판 |
| 4-27 | 122pxsheol 기반 | 6 | 0.5 | A | 까탸 전용 |
| 4-28 | Namori 까탸 | 6 | 0.1 | A(blurry위치변경) | Rescale 0.1 매우 낮음 |
| 4-29 | Channel 2.0 기반 | 6 | 0.5 | B | channel 2.0 가중치 |
| 4-30 | 제갈량 리마스터 | 6 | 0.2 | B | 제갈량 딸내미 리마스터 |
| 4-31 | 6 (yuchae) 기반 | 6 | 0.3 | B | - |
| 4-32 | Sushio 기반 | 6 | 0.5 | B | - |
| 4-33 | Arisaka Ako 기반 | 6 | 0.5~0.6 | B | `chooco (chocoshi)` 배경의 신 |
| 4-34 | Yoneyama Mai 배경 원툴 | 5 | 0.3~0.5 | B | 배경 원툴 |
| 4-35 | Arisaka Ako v2 (만들던 중) | 5 | 0.5 | A | 진행 중 |

#### 개별 스타일 상세

<details>
<summary><strong>4-1. Yamamoto Souichirou 기반 (최애)</strong></summary>

**Artist:**
```
1.2::artist:yamamoto souichirou::, 0.7::artist:ciloranko::, 1.0::artist:channel (caststation)::, 1.1::artist:ratatatat74::, 1.1::artist:gogalking::, 0.5::artist:ohisashiburi::, 0.9::artist:kyo-hei (kyouhei)::
```
**Quality:**
```
newest, year 2025, year 2024, -4::artist collaboration::, -3::simple illustration, jaggy lines, oekaki, multiple shots, unfinished, blurry, dead eyes, blank eyes::, 1.2::shiny skin, dot nose::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes
```
</details>

<details>
<summary><strong>4-2. Mori Taishi 기반</strong></summary>

**Artist:**
```
0.1::style parody:danganronpa_(series)::, 0.2::artist:mizuryu kei::, 0.2::artist:ciloranko::, 0.7::artist:gogalking::, 0.7::artist:ratatatat74::, 1.0::artist:mameojitan::, 1.0::artist:mochizuki kei::, 1.2::artist:rifleman1130::, 1.5::artist:mori taishi::
```
**Quality:**
```
year 2025, year 2024, depth of field, distinct image, volumetric lighting, no text, 1.2::masterpiece, masterpiece portrait, best quality, amazing quality, very aesthetic, extremely detailed, highres, absurdres, intricate details, hyper detail, finely detailed::, -3.0::blurry, unfinished, simple illustration::, -3.0::artist collaboration::
```
**별도 네거티브:** 4-2, 4-3, 4-4, 4-5, 4-6은 각각 별도 네거티브를 사용하며 원본 게시글 참조.
</details>

<details>
<summary><strong>4-3. Karlyn jaggy lines</strong></summary>

**Artist:**
```
0.7::artist:ciloranko::, 0.7::artist:gogalking::, 1.0::artist:karyln::, 1.0::artist:mizu cx::, 1.0::artist:quezify::, 1.0::artist:modare::, 1.2::artist:ask (askzy)::, 1.2::artist:ningen mame::, 1.5::artist:healthyman::, 3.0::jaggy lines, no lineart::, -4.0::flat color::
```
**Quality:** 4-2와 동일
</details>

<details>
<summary><strong>4-4. Rifleman1130 기반</strong></summary>

**Artist:**
```
1.2::artist:rifleman1130::, 1.2::artist:myabit::, 1.0::artist:shexyo::, 1.0::artist:gogalking::, 1.0::artist:do m kaeru::, 1.0::artist:mx2j::, 0.4::artist:tianliang duohe fangdongye::, 0.2::artist:dog-san::, 0.2::artist:ask (askzy)::
```
**Quality:**
```
-3::artist collaboration::, year 2025, year 2024, no text, -1.0::multiple views::, 1.2::best quality, very aesthetic, absurdres::, masterpiece, no text
```
</details>

<details>
<summary><strong>4-5. Myabit/Ohisashiburi 기반</strong></summary>

**Artist:**
```
0.2::artist:asanagi::, 0.5::artist:ahemaru::, 0.7::artist:ciloranko::, 0.7::artist:ningen mame::, 1.0::artist:gogalking::, 1.0::artist:hyulla::, 1.0::artist:beeeeen::, 1.5::artist:myabit::, 1.5::artist:ohisashiburi::
```
**Quality:** 4-4와 동일
</details>

<details>
<summary><strong>4-6. Shexyo/Asura 기반</strong></summary>

**Artist:**
```
0.2::artist:mizuryu kei::, 0.5::artist:gogalking::, 0.5::artist:krekkov::, 0.5::artist:ciloranko::, 0.7::artist:wagash (dagashiya)::, 1.0::artist:j.k::, 1.0::artist:quasarcake::, 1.2::artist:mochizuki kei::, 1.5::artist:shexyo::, 1.8::artist:asura (asurauser)::, -4.0::flat color, minimalism::
```
**Quality:** 4-4와 동일 + `-1.0::upscaled::` 추가
</details>

<details>
<summary><strong>4-7. 제갈량 딸내미</strong></summary>

**Artist:**
```
0.3::artist:ask (askzy)::, 0.5::artist:noyu (noyu23386566)::, 0.6::artist:ratatatat74::, 0.7::artist:john kafka::, 0.8::artist:rei (sanbonzakura)::, 1.2::artist:gogalking::, 1.3::aritst:magotsuki (hurray)::, 1.5::artist:ohisashiburi::, -4.0::flat color, minimalism::
```
**Quality:**
```
year 2025, year 2024, no text, -1::multiple views, upscaled, blurry, bad hands, undetailed hands, bad anatomy::, detailed eyes, detailed hands, perfect anatomy, depth of field, volumetric lighting, masterpiece, best quality, very aesthetic, absurdres
```
</details>

<details>
<summary><strong>4-8. Gogalking 2.0 기반</strong></summary>

**Artist:**
```
0.7::artist:blackbox (blackbox9158)::, 0.9::artist:sukja::, 1.3::artist:haragaita i::, 1.0::artist:rei (sanbonzakura)::, 1.5::artist:mika pizako::, 1.0::artist:myabit::, 1.0::artist:kim eb::, 1.1::artist:starshadowmagician::, 2.0::artist:gogalking::, 1.4::artist:wanke::, 1.3::artist:yoneyama mai::
```
**Quality:**
```
newest, year 2025, year 2024, -3::simple illustration, jaggy lines, oekaki, multiple shots, artist collaboration, unfinished::, 2::shiny skin::, 3.45::official style, pixiv commission::, vivid details, soft shading, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration
```
**네거티브:** A + sweat 제거
</details>

<details>
<summary><strong>4-9. Channel (caststation) 기반</strong></summary>

**Artist:**
```
1.2::artist:channel (caststation)::, 0.3::artist:quasarcake::, 1.0::artist:gogalking::, 0.6::artist:rurudo::, 0.5::artist:nyte tyde::, 0.8::artist:john kafka::, 0.7::artist:dishwasher1910::, 0.4::artist:seapall::
```
**Quality:**
```
newest, year 2025, year 2024, -3::simple illustration, multiple shots, artist collaboration, unfinished, dead eyes, blank eyes::, 1.2::shiny skin, dewy skin::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes
```
</details>

<details>
<summary><strong>4-10. Ao 순정만화 1</strong></summary>

**Artist:**
```
1.2::artist:ratatatat74::, 0.4::artist:quasarcake::, 0.8::artist:ciloranko::, 0.9::artist:channel (caststation)::, 0.7::artist:mika pizako::, 1.5::artist:ao (ao0 0nemu)::, 0.6::artist:qiandaiyiyu::, 0.5::artist:noyu (noyu23386566)::, 0.2::artist:blackbox (blackbox9158)::
```
**Quality:** 4-1과 동일
</details>

<details>
<summary><strong>4-11. 순정만화 2</strong></summary>

**Artist:**
```
1.2::artist:gogalking::, 0.6::artist:qiandaiyiyu::, 0.4::artist:quasarcake::, 0.8::artist:ciloranko::, 0.9::artist:channel (caststation)::, 0.7::artist:mika pizako::, 1.5::artist:ao (ao0 0nemu)::, 0.5::artist:noyu (noyu23386566)::, 0.2::artist:blackbox (blackbox9158)::
```
**Quality:** 4-1과 동일
</details>

<details>
<summary><strong>4-12. Starshadowmagician 기반</strong></summary>

**Artist:**
```
0.6::artist:wanke::, 1.0::artist:dishwasher1910::, 0.9::artist:ratatatat74::, 0.8::artist:blackbox (blackbox9158)::, 0.5::artist:sukja::, 1.2::artist:hanaseto::, 0.7::artist:others (gogo-o)::, 0.4::artist:aoseagrass::, 1.5::artist:starshadowmagician::
```
**Quality:**
```
newest, year 2025, year 2024, -4::artist collaboration::, -3::simple illustration, jaggy lines, oekaki, multiple shots, unfinished, blurry, dead eyes, blank eyes, blush stripes::, 3.45::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes
```
</details>

<details>
<summary><strong>4-13. Karyln/Rusellunt 기반</strong></summary>

**Artist:**
```
1.21::artist:karyln::, 1.03::artist:ohisashiburi::, 1.29::artist:rusellunt::, 1.0::artist:modare::, 0.98::artist:ningen mame::, 0.97::artist:john kafka::, 0.69::artist:kim hyung tae::, 0.65::artist:gogalking::, 0.21::artist:qiandaiyiyu::
```
**Quality:**
```
newest, year 2025, year 2024, -4::artist collaboration::, -3::simple illustration, multiple shots, unfinished, blurry, dead eyes, blank eyes::, 3::official style, pixiv commission, shiny skin::, perfect anatomy, highly finished, amazing quality, best quality, masterpiece, very aesthetic, absurdres, best illustration, beautiful eyes
```
</details>

<details>
<summary><strong>4-14. Sapysha 파인애플</strong></summary>

**Artist:**
```
1.68::artist:sapysha::, 1.18::artist:ratatatat74::, 1.01::artist:rusellunt::, 0.97::artist:abae::, 0.96::artist:gemi ningen::, 0.68::artist:hiita (hitta 99)::, 0.38::artist:yamamoto souichirou::
```
**Quality:** 4-1과 동일
</details>

<details>
<summary><strong>4-15. Mori Taishi 3d</strong></summary>

**Artist:**
```
1.3::artist:mori taishi::, 1.2::artist:mameojitan::, 1.11::artist:ratatatat74::, 1.1::artist:gogalking::, 1.0::artist:liduke::, 0.9::artist:modare::, 0.8::artist:izuru (timbermetal)::, 0.3::artist:ciloranko::, 0.2::artist:mizuryu kei::
```
**Quality:**
```
year 2025, year 2024, newest, -4::artist collaboration::, -3::simple illustration, multiple shots, unfinished::, -1::blurry, flat color, dead eyes, blank eyes::, 3d, 3::official style, pixiv commission::, perfect anatomy, commission, highly finished, amazing quality, top aesthetic, masterpiece, very aesthetic, absurdres, highres, best quality, best illustration, beautiful eyes
```
</details>

<details>
<summary><strong>4-16. Game CG 3d</strong></summary>

**Artist:**
```
1.1::artist:ratatatat74::, .85::artist:nyte tyde::, 1.2::artist:try (lsc)::, 1.1::artist:sho (sho lwlw)::, 1::artist:ask (askzy)::, 1.8::artist:modare::, 1.05::artist:henriiku (ahemaru)::, .8::artist:reoen::, 1.75::artist:ssambatea::, .75::artist:wanke::, .9::artist:yamamoto souichirou::, .7::artist:dishwasher1910::, .65::artist:ningen mame::, .6::artist:kim hyung tae::
```
**Quality:**
```
2::official art::, ai-generated, shiny skin, detailed background, depth of field, volumetric lighting, 1.5::3d::, rating:explicit, 1.2::game cg::, year 2024, year 2025, highly detailed, detailed, masterpiece, best quality, very aesthetic, highres, best illustration, no text, -2::reference sheet, multiple shots, simple illustration, censored, dithering, sweat, negative space, dead eyes::, -3::artist collaboration::
```
</details>

<details>
<summary><strong>4-17. Kawacy 기반</strong></summary>

**Artist:**
```
1.5::artist:yamamoto souichirou::, 1::artist:channel (caststation)::, 1.1::artist:gogalking::, .9::artist:ratatatat74::, .7::artist:ohisashiburi::, .8::artist:john kafka::, .6::artist:wanke::, 1.4::artist:kawacy::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, unfinished, jaggy lines, dead eyes::, detailed background, beautiful eyes, 2::official art, commission, best illustration::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text
```
</details>

<details>
<summary><strong>4-18. Rolua 기반</strong></summary>

**Artist:**
```
1.4::artist:rolua::, 1.3::artist:ohisashiburi::, 1.2::artist:qys3::, 1.1::aritst:tekito midori::, 1.0::aritst:sheya::, 0.9::artist:dishwasher1910::, 0.75::artist:kawacy::, 0.7::artist:kupa (jesterwii)::, 0.65::artist:channel (caststation)::, 0.6::artist:anmi::, 0.5::artist:tianliang duohe fangdongye::
```
**Quality:** 4-17과 동일 (jaggy lines 제외)
</details>

<details>
<summary><strong>4-19. K.pumpkin 새벽풍</strong></summary>

**Artist:**
```
1.5::artist:k.pumpkin::, 1.3::artist:mori taishi::, 1.2::artist:kkuem::, 1.1::artist:torino aqua::, 1.0::artist:danimaru::, 0.95::artist:shinkai makoto::, 0.9::artist:channel (caststation)::, 0.8::artist:ohisashiburi::, 0.7::artist:ask (askzy)::, 0.6::artist:ratatatat74::, 0.3::artist:au (d elete)::
```
**Quality:** 4-17과 동일 (dithering 제거)
</details>

<details>
<summary><strong>4-20. Yueepon 게임CG</strong></summary>

**Artist:**
```
1.8::artist:yueepon::, 1.7::artist:dishwasher1910::, 1.5::artist:33 gaff::, 1.3::artist:kenkou cross::, 1::artist:ssambatea::, .9::artist:ratatatat74::, .85::artist:ciloranko::, .8::artist:wanke::, .7::artist:rurudo::, .6::artist:channel (caststation)::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text
```
</details>

<details>
<summary><strong>4-21. 말랑이 (dishwasher1910 주도)</strong></summary>

**Artist:**
```
1.7::artist:dishwasher1910::, 1.5::artist:33 gaff::, 1.3::artist:kenkou cross::, 1.2::artist:yueepon::, 1::artist:ssambatea::, .9::artist:ratatatat74::, .85::artist:ciloranko::, .8::artist:wanke::, .7::artist:rurudo::, .6::artist:channel (caststation)::
```
**Quality:** 4-20과 동일
**비고:** 이미 캐챗 제작자 사용 중. 별도 간결 네거티브.
</details>

<details>
<summary><strong>4-22. Kishida Mel 기반</strong></summary>

**Artist:**
```
1.4::artist:kishida mel::, 1.3::artist:myabit::, 1.2::artist:gogalking::, 1.1::artist:kawacy::, 1::artist:reoen::, 0.9::artist:wanke::, 0.8::artist:channel (caststation)::, 0.5::artist:fajyobore::, 0.4::artist:quasarcake::, 0.7::artist:healthyman::
```
**Quality:**
```
year 2025, year 2024, newest, -6::artist collaboration, simple illustration, multiple shots::, detailed background, 2::official art, commission, best illustration, game cg, depth of field::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, no text
```
**비고:** 눈이 예쁨. `-6::` 매우 강한 네거티브 가중치. 별도 간결 네거티브.
</details>

<details>
<summary><strong>4-23. Lam 기반</strong></summary>

**Artist:**
```
1.4::artist:lam (ramdayo)::, 1.3::artist:ohisashiburi::, 1.2::artist:mebaru::, 1::artist:channel (caststation)::, 0.8::artist:yamamoto souichirou::, 0.7::artist:mameojitan::, 0.6::artist:abandon ranka::, 0.5::artist:gogalking::, 0.4::artist:iuui::, 0.2::artist:spacezin::, 0.1::artist:au (d elete)::
```
**Quality:** 4-20과 동일
**비고:** `au (d elete)` 선택적
</details>

<details>
<summary><strong>4-24. John Kafka 기반</strong></summary>

**Artist:**
```
1.7::artist:gogalking::, 1.5::artist:ratatatat74::, 1.2::artist:rsef::, 1.1::artist:ask (askzy)::, 1::artist:modare::, 0.8::artist:hwansang::, 0.6::artist:channel (caststation)::, 0.5::artist:wlop::, 0.1::artist:au (d elete)::, 1.4::artist:john kafka::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, game cg, depth of field, dot nose::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text
```
**비고:** `dot nose` 선택적. 캐챗 <적과 백> 사용.
</details>

<details>
<summary><strong>4-25. Love Cacao 기반</strong></summary>

**Artist:**
```
1.5::artist:love cacao::, 1.2::artist:au (d elete)::, 1.0::artist:nixeu::, 1.05::artist:dishwasher1910::, 0.94::artist:yoneyama mai::, 1.1::artist:wanke::, 0.98::artist:mochizuki kei::, 0.67::artist:ohisashiburi::, 0.8::artist:liduke::, 1.15::artist:joosibi::, 0.8::artist:96yottea::, 0.3::artist:pottsness::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots::, detailed background, shiny skin, 2::official art, commission, best illustration, depth of field, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text
```
**비고:** `pottsness` 선택적
</details>

<details>
<summary><strong>4-26. Rusellunt 개선</strong></summary>

**Artist:**
```
1.5::artist:rusellunt::, 1.1::artist:yamamoto souichirou::, 1.0::artist:gogalking::, 0.95::artist:kim hyung tae::, 0.9::artist:k.pumpkin::, 0.85::artist:kishida mel::, 0.8::artist:ask (askzy)::, 0.75::artist:wagashi (dagashiya)::, 0.6::artist:magotsuki (hurray)::, 0.5::aritst:shinkai makoto::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, shiny skin, 2::official art, commission, best illustration, depth of field, game cg, dot nose::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed
```
**비고:** 최애 그림체 개선판
</details>

<details>
<summary><strong>4-27. 122pxsheol 기반</strong></summary>

**Artist:**
```
1.2::artist:122pxsheol::, 1.1::aritst:ohisashiburi::, 1::artist:oharu-chan::, 0.9::artist:mameojitan::, 0.8::artist:dorontabi::, 0.7::artist:ciloranko::, 0.6::artist:quasarcake::, 0.4::artist:noyu (noyu23386566)::, 0.3::artist:channel (caststation)::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, dead eyes::, detailed background, depth of field, 2::official art, commission, best illustration::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text
```
**비고:** 까탸 전용
</details>

<details>
<summary><strong>4-28. Namori 까탸</strong></summary>

**Artist:**
```
1.5::artist:namori::, 1.1::artist:channel (caststation)::, 1.0::artist:ohisashiburi::, .9::artist:modare::, .8::artist:noyu (noyu23386566)::, .7::artist:gogalking::, 0.6::artist:yamamoto souichirou::, .5::artist:122pxsheol::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, detailed background, 2::official art, commission, best illustration, atmospheric perspective, depth of field, game cg::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text
```
**비고:** Rescale 0.1 매우 낮음. 네거티브A 사용하되 blurry 위치 변경.
</details>

<details>
<summary><strong>4-29. Channel 2.0 기반</strong></summary>

**Artist:**
```
2::artist:channel (caststation)::, 1.5::artist:ratatatat74::, 1.2::artist:ebora::, 1.1::artist:yoneyama mai::, 1::artist:baffu::, .9::artist:haguhagu (rinjuu circus)::, .8::artist:myabit::, .7::artist:eonsang::, .6::artist:nagi itsuki::, .5::artist:henriiku (ahemaru)::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration::, detailed background, shiny skin, 2::depth of field, official art, commission, best illustration::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text
```
</details>

<details>
<summary><strong>4-30. 제갈량 리마스터</strong></summary>

**Artist:**
```
1.5::artist:ohisashiburi::, 1.2::artist:john kafka::, 1.1::artist:secretfj520, artist:mameojitan::, 1::artist:magotsuki (hurray)::, .9::artist:modare::, .8::artist:ssambatea, artist:ask (askzy)::, .7::artist:chooco (chocoshi)::, .3::artist:channel (caststation)::, .6::artist:noyu (noyu23386566)::
```
**Quality:** 4-17과 동일
</details>

<details>
<summary><strong>4-31. 6 (yuchae) 기반</strong></summary>

**Artist:**
```
1.6::artist:6 (yuchae)::, 1.3::artist:yueepon::, 1.1::artist:channel (caststation)::, 1::artist:maccha (mochancc)::, .9::artist:gogalking::, .8::artist:ratatatat74, artist:chooco (chocoshi)::, .7::artist:wanke::, .5::artist:rurudo::, .6::artist:dishwasher1910::
```
**Quality:** 4-20과 동일
</details>

<details>
<summary><strong>4-32. Sushio 기반</strong></summary>

**Artist:**
```
1.5::artist:sushio::, 1.2::artist:magotsuki (hurray)::, 1.1::artist:secretfj520, artist:channel (caststation)::, 1::artist:ratatatat74, artist:john kafka::, .9::artist:gogalking::, .8::artist:ssambatea, artist:ask (askzy)::, .5::artist:noyu (noyu23386566)::
```
**Quality:** 4-20과 동일 (game cg, depth of field 포함)
</details>

<details>
<summary><strong>4-33. Arisaka Ako 기반</strong></summary>

**Artist:**
```
1.6::artist:arisaka ako::, 1.3::artist:yumi xsh::, 1.1::artist:haihaiera::, 1::artist:yoneyama mai::, .9::artist:secretfj520::, .7::artist:pigeon666::, .6::artist:33gaff::, .5::artist:john kafka, artist:chooco (chocoshi)::, .8::artist:gogalking::, .7::artist:channel (caststation)::
```
**Quality:** 4-29와 동일 (game cg 포함)
**비고:** `chooco (chocoshi)` 배경의 신
</details>

<details>
<summary><strong>4-34. Yoneyama Mai 배경 원툴</strong></summary>

**Artist:**
```
1.5::artist:yoneyama mai::, 1.1::artist:john kafka::, 1::artist:gogalking::, .9::artist:wlop, artist:maeka (kumaekake), artist:ohisashiburi::, .8::artist:ssambatea::, .7::artist:nagi itsuki, artist:chooco (chocoshi)::, .6::artist:sanshoku dango (shukosuko)::, .5::artist:channel (caststation), artist:nengoro::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, dead eyes::, detailed background, 2::offcial art, commission, best illustration, atmospheric perspective, depth of field::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, highly detailed, no text
```
**비고:** 배경 원툴. `offcial art` 오타 원문 유지.
</details>

<details>
<summary><strong>4-35. Arisaka Ako v2 (만들던 중)</strong></summary>

**Artist:**
```
1.4::artist:arisaka ako::, 1.3::artist:yumi xsh::, 1.2::artist:channel (caststation)::, 1.1::artist:haihaiera::, 1::artist:yoneyama mai::, .9::artist:secretfj520, artist:nengoro::, .7::artist:pigeon666::, .6::artist:33gaff::, .5::artist:john kafka::, .7::artist:tokunaga akimasa, artist:chooco (chochoshi), artist:void 0, artist:wlop, artist:fjsmu::, .8::artist:gogalking::
```
**Quality:**
```
year 2025, year 2024, newest, -3::artist collaboration, simple illustration, multiple shots, dead eyes::, 2::depth of field, official art, commission, best illustration, game cg, detailed hands::, masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, no text
```
**비고:** 진행 중
</details>

---

### #5 — 힐링 짤털 그림체 (Minaba Hideo 기반)
- **출처**: https://arca.live/b/aiart/168293480
- **추출일**: 2026-04-23
- **Model**: NAI V4.5 Full
- **Sampler**: k_euler_ancestral (karras)

**Artist 태그:**
```
1.5::artist:minaba hideo::, 1.25::artist:yoneyama mai::, ::artist:teshima nari::, 0.75::artist:solipsist::, 0.5::artist:tayumeru::, 0.25::artist:freng::, 0.75::artist:96yottea::, ::artist:zero q 0q::, 1.25::artist:ikezaki misa::
```

**스타일 태그:**
```
-2::flat color, monochrome::, -2::signature, artist name, artist socials::, -1::x-ray, censored, crowd, painting (object), photo (object), nostrils, text box, english text::
```

**Quality:**
```
prefix: year 2025, year 2024, year 2023, -6::artist collaboration::
suffix: best illustration, best quality, highres, absurdres, aesthetic
```

**네거티브 (전문):**
```
natsuki karin, text, logo, watermark, too many watermarks, blank page, text-only page, reference, username, signature, artist:xinzoruo, artist:milkpanda, artist collaboration, variant set, large variant set, 4koma, 2koma, toon (style), oekaki, chibi, turnaround, film grain, monochrome, dithering, halftone, screentones, dated, old, 1990s (style), mutation, deformed, distorted, disfigured, artistic error, distorted anatomy, anatomical structure error, asymmetrical face, unnatural hair, bad eyes, cloudy eyes, blank eyes, bad proportions, bad limb, extra digits, bad legs, extra legs, amputee, distorted composition, bad perspective, multiple views, negative space, animation error, chromatic aberration, disorganized colors, scan artifacts, jpeg artifacts, vertical lines, vertical banding, worst quality, bad quality, lowres, blurry, upscaled, fewer details, unfinished, incomplete, amateur, cheesy, unsatisfactory, inadequate, deficient, subpar, poor, displeasing, very displeasing, bad illustration, bad portrait, puckered lips, armpit hair, spanked, thick lips
```

**특이사항:**
- 작성자 코멘트: "무슨 그림체라고 해야하는지는 모르겠지만 나쁘지 않아서 공유해봄"
- Minaba Hideo 1.5 최고 가중치, Yoneyama Mai 1.25, Ikezaki Misa 1.25 — 밝고 따뜻한 화풍
- `natsuki karin` 네거티브 — 특정 캐릭터 배제
- `puckered lips, armpit hair, spanked, thick lips` — 특이 네거티브
- NAI Studio에 `minaba-hideo` 템플릿으로 등록됨

---

### #6 — 쥬지가 반응하는 깔끔한 동인풍 그림체 (Teshima Nari 기반)
- **출처**: https://arca.live/b/aiart/168392484
- **추출일**: 2026-04-23
- **Model**: NAI V4.5 Full
- **Scale**: 5.0 | **Steps**: 28 | **Sampler**: k_euler_ancestral (karras)
- **CFG Rescale**: 0.40
- **원글 참고**: "이 전에 다른 챈럼한테 톳거한 그림체인데 원본글이 사라져서 다시 업로드함... 세팅값도 알려달라는 챈럼 있어서 이번엔 세팅값도 첨부함"

**Artist 태그:**
```
realistic, 1.5::artist:solipsist::, 2.5::artist:teshima nari::, 2::artist:nekojira::, 0.5::artist:herio, artist:henken::, 2::artist:ohisashiburi, artist:vertigris, artist:ningen mame, artist:rusellunt::, 1::artist:pija (pianiishimo)::, 1::artist:sohn woohyoung, artist:imamura ryou::, ::artist:ie (raarami)::, 1.5::artist:lonklink::, 2.2::artist:inoue kiyoshirou::, 2.0::artist:gogalking::, 1.4::artist:kurono mitsuki::
```

**스타일 태그:**
```
-1::flat color::, pastel color, 1.2::photorealistic::, 1.5::realistic texture, smooth gradients, balanced contrast, detailed shading::
```

**Quality:**
```
prefix: year 2025, year 2024, year 2023, -3.0::multiple views::, -1.0::greyscale::, -2.0::bad hands::, -4.0::username::, -4.0::signature::, -5::artist collaboration::, -3::anatomical nonsense::
suffix: -2::artist name, artist socials, multiple views, bad anatomy, crowd::, best illustration, best quality, highres, absurdres, aesthetic, nsfw, very aesthetic, masterpiece, no text
```

**네거티브 (전문):**
```
lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, negative space, blank page, natsuki karin, text, logo, watermark, too many watermarks, blank page, text-only page, reference, username, signature, artist:xinzoruo, artist:milkpanda, artist collaboration, variant set, large variant set, 4koma, 2koma, toon (style), chibi, turnaround, film grain, monochrome, dithering, halftone, screentones, dated, old, 1990s (style), mutation, deformed, distorted, disfigured, artistic error, distorted anatomy, anatomical structure error, asymmetrical face, unnatural hair, bad eyes, cloudy eyes, blank eyes, bad proportions, bad limb, extra digits, bad legs, extra legs, amputee, distorted composition, bad perspective, multiple views, negative space, animation error, chromatic aberration, disorganized colors, scan artifacts, jpeg artifacts, vertical lines, vertical banding, worst quality, bad quality, lowres, blurry, upscaled, fewer details, unfinished, incomplete, amateur, cheesy, unsatisfactory, inadequate, deficient, subpar, poor, displeasing, very displeasing, bad illustration, bad portrait, sketch
```

**특이사항:**
- `teshima nari` 2.5 최고 가중치, `inoue kiyoshirou` 2.2, `gogalking` 2.0 — 깔끔한 동인풍 핵심
- `realistic` + `1.2::photorealistic::` — 세미리얼 질감
- `-1::flat color::` — 플랫컬러 억제로 그라데이션 강조
- Scale 5.0 + CFG Rescale 0.40 — 부드러운 출력
- 추천 59, 댓글 19 — 높은 커뮤니티 반응
- NAI Studio에 `teshima-doujin` 템플릿으로 등록됨

---

### 메타데이터 없음 — 2026-04-23 일괄 확인

아래 URL들은 메타데이터가 제거된 상태 (PNG tEXt/iTXt 청크 없음, 또는 webp/jpg 변환). Vibe Transfer 참조 용도로만 활용 가능.

| # | URL (축약) | 포맷 | 내용 |
|---|-----------|------|------|
| - | d23b1c27...png | PNG 832×1216 | 석양 배경 흑발 소녀, 무드 있는 연출 |
| - | ff9dac65...png | PNG 1024×1024 | 핑크머리 비키니, 밝은 톤 |
| - | e5ea8193...png | PNG 1216×832 | 핑크/레드 머리 두 소녀, 샤워 장면 |
| - | bfc9e0ca...webp | WebP | 카페에서 커피 마시는 흑발 여성, 고퀄 배경 |
| - | ab084d65...png | PNG 1216×832 | 핑크머리 메이드, NSFW |
| - | ad44fb6b...jpg | JPEG 832×1216 | 교복 드럼 소녀, 흑발 |
| - | b1eec26c...png | PNG 832×1216 | 은발 셔츠 소녀, 침대 위 |
| - | 6561dfa7...png | PNG 1024×1024 | 블루머리 뒷모습, 스타킹 |
| - | b79d0bc5...png | PNG 832×1216 | 흑발 소녀, 팬티 제시 |
| - | 30e38159...png | PNG 832×1216 | 오렌지머리 도시 패션, 베레모 |
