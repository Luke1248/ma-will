# Dataset build

`data/hsk{1..6}.json` is generated, not hand-written. To regenerate:

```bash
npm init -y
npm install @leonsilicon/hsk2.0 cc-cedict
# place the HSK word-list package contents under ./package (npm pack @leonsilicon/hsk2.0)
OUTDIR=../data node build-dataset.cjs
```

The script joins the official **HSK 2.0** word lists with **CC-CEDICT**:
converts numbered pinyin (`ni3 hao3`) to tone marks (`nǐ hǎo`), picks the most
useful sense per word, resolves cross-references (`variant of …`, `see …`),
and caps definition length. All 5,000 words resolve to a real definition.
