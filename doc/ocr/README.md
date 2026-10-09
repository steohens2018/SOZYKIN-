# Распознавание текста на фото

Файлы [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 (лицензия Apache-2.0)
и русская модель `rus.traineddata` (4.0.0_best_int, из `@tesseract.js-data/rus` 1.0.0).
Лежат рядом с приложением, чтобы фото распознавалось на устройстве: без сторонних
серверов и без интернета после первой загрузки.

- `tesseract.min.js`, `worker.min.js` — из `tesseract.js@5.1.1/dist`
- `tesseract-core-simd-lstm.wasm.js`, `tesseract-core-lstm.wasm.js` — из `tesseract.js-core@5.1.1`
