# Pronunciation Rating Platform

This static browser platform collects three listener-based measures from participant speech recordings:

- `comprehensibility_1_10`: 1 = very easy to understand, 10 = extremely difficult to understand.
- `accentedness_1_10`: 1 = no noticeable accent, 10 = extremely strong accent.
- `intelligibility`: typed spelling of the heard word, with exact-match auto-scoring when the target word is available.

The design follows the listener-based word-level measurement logic in Uchihara (2022), adapted to a 10-point scale and a combined trial format.

## Entry Point

```text
Rating_Platform/index.html
```

From `Experiment/`, preview locally with:

```sh
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/Rating_Platform/
```

## Workflow

1. Enter a rater ID and session label.
2. Either load a GitHub manifest and select a participant ID, or upload local WAV files.
3. Optionally upload a local manifest CSV with metadata.
4. Click `Prepare selected participant` for GitHub audio, or `Prepare trials` for local audio.
5. Click `Start rating`.
6. Choose a task mode:
   - `Combined`: collect ratings and dictation in the same trial.
   - `Ratings only`: collect comprehensibility and accentedness.
   - `Dictation only`: collect intelligibility responses.
7. For each sample, play the audio once, then complete the displayed response fields.
8. Download the ZIP at the end of the session.

## GitHub Audio Workflow

Use `remote_manifest.csv` when participant recordings are already uploaded to GitHub or GitHub Pages. The setup screen reads this CSV, lists the available `participant_id` values, and prepares only the selected participant's files for the current rater.

Recommended GitHub Pages layout:

```text
Rating_Platform/
  index.html
  remote_manifest.csv
  recordings/
    001/
      001_production_001_icicle.wav
      001_production_002_acorn.wav
    002/
      002_production_001_icicle.wav
```

In this layout, `remote_manifest.csv` can use relative paths:

```csv
audio_file,target_word,participant_id,native_language,condition
recordings/001/001_production_001_icicle.wav,icicle,001,japanese,production
recordings/001/001_production_002_acorn.wav,acorn,001,japanese,production
recordings/002/002_production_001_icicle.wav,icicle,002,chinese,production
```

You can also use an absolute `audio_url` column for raw GitHub or another static host:

```csv
audio_url,target_word,participant_id,native_language,condition
https://raw.githubusercontent.com/Ryuya-dot-com/Accentedness/main/Rating_Platform/recordings/001/001_production_001_icicle.wav,icicle,001,japanese,production
```

Rater flow:

1. Enter `Rater ID`.
2. Enter the manifest URL, such as `remote_manifest.csv` or a raw GitHub URL.
3. Click `Load participants`.
4. Select a `Participant ID`.
5. Click `Prepare selected participant`.
6. Start rating.

The downloaded CSV and assignment JSON include `audio_url`, `source_path`, and `participant_id` so the rated material can be audited later. See `remote_manifest_template.csv` for a minimal template.

## Manifest CSV

The manifest is optional. The platform can infer target words from these existing filename patterns:

```text
001_production_001_icicle.wav
001_japanese_pass01_natural_english_word001_icicle_take01_trial0001_talker_m1_guy.wav
```

Use a manifest when filenames do not include enough metadata or when you want to preserve experimental condition labels.

Supported column names include:

- `audio_file`, `file`, `filename`, or `path`
- `audio_url`, `url`, `source_url`, or `raw_url`
- `target_word`, `word`, `item`, or `expected_word`
- `participant_id`, `participant`, `speaker_id`, or `speaker`
- `native_language`, `native`, or `l1`
- `condition`, `pass_condition`, or `variability_condition`
- `accent_condition` or `accent`
- `talker`, `talker_id`, `voice`, or `voice_alias`
- `pass_number`, `trial_number`, `word_number`, `take_number`
- `spoken_form`, `spoken_text`, or `prompt`
- `practice_note`, `note`, or `notes`

See `manifest_template.csv`.

## Practice Accent Samples

Synthetic practice samples can be generated locally on macOS:

```sh
bash Rating_Platform/scripts/generate_practice_accent_audio.sh
```

This creates:

```text
Rating_Platform/practice_audio/english/{chocolate,coffee,pizza,sofa}.wav
Rating_Platform/practice_audio/japanese/{chocolate,coffee,pizza,sofa}.wav
Rating_Platform/practice_audio/chinese/{chocolate,coffee,pizza,sofa}.wav
Rating_Platform/practice_manifest.csv
```

The English samples use English TTS. The Japanese samples use katakana-shaped forms such as `チョコレート`, and the Chinese samples use comparable loanword/cognate forms such as `巧克力`. These are for rater practice and interface checks only, not for final data collection.

After generating the files, start the local web server and click `Load practice samples` in the setup screen. The bundled practice loader uses browser `fetch`, so use `http://127.0.0.1:8765/Rating_Platform/` rather than opening `index.html` directly from Finder.

## Output

The ZIP contains:

- `{rater}_{session}_pronunciation_ratings.csv`
- `{rater}_{session}_pronunciation_ratings_assignment.json`

Important CSV columns:

- `typed_response`
- `normalized_response`
- `target_word`
- `intelligibility_exact`
- `intelligibility_needs_manual_review`
- `first_key_rt_ms`
- `submit_rt_ms`
- `comprehensibility_1_10`
- `accentedness_1_10`

Exact-match scoring is intentionally conservative. Following Uchihara (2022), minor misspellings can be treated as correct during later manual coding; non-exact rows are flagged with `intelligibility_needs_manual_review = 1`.
