# 03 — The Corpus: which books, and why

The brief fixed two (Bible, Qur'ān) and left two open: "a book that is a lot of
interpretation and is a basis for Asians", plus one for India. Note that India is
of course in Asia — the distinction being drawn is **East Asia** and **South
Asia**, and that is how it is resolved here.

**Revised: both, on each side.** The decision was then taken to carry both
Chinese works and both Indian works rather than choosing. That gives six:
Bible, Qur'ān, Analects, Dao De Jing, Bhagavad Gītā, Principal Upaniṣads. This
is worth doing — the second work in each pair is not a duplicate, it is the
*opposition* to the first, and it exercises parts of the architecture the first
one does not.

**Note on the count:** six, not five. Both-Chinese plus both-Indian plus Bible
plus Qur'ān comes to six works. Everything here is built for six; say the word
if one should be dropped.

Selection criteria, in priority order:

1. **Depth of existing commentary** — the imported layers are the initial asset.
2. **Internal contestation** — commentators who disagree *irreconcilably* are
   what make a layer switcher meaningful rather than decorative.
3. **A stable reference system** — a centuries-old citation grammar to use as the
   Canonical Reference ([`01-anchoring.md`](01-anchoring.md)).
4. **Public-domain availability** of source text and at least one commentary.
5. **Tractable size** for a first corpus.

---

## 1. Bible

**Reference system:** `bible:BOOK.chapter.verse`, USFM book codes. 31,102 verses.
Established by Stephen Langton (chapters, c. 1227) and Robert Estienne (verses,
1551) — and stable across every translation since, which is exactly the property
the CR needs.

**Source editions:** Westminster Leningrad Codex (Hebrew, PD); SBLGNT or
Westcott–Hort / Tischendorf (Greek, PD or free licence).
**Translations:** KJV, ASV 1901, World English Bible, Darby, Young's Literal — all
public domain.
**Commentary available in PD:** Matthew Henry, Calvin, Gill, Barnes, Clarke,
Jamieson–Fausset–Brown; Rashi and Ibn Ezra in the original and in older
translations.

**Constraints:** The KJV is under perpetual Crown letters patent in the United
Kingdom — untroubled elsewhere, but it must be recorded per-jurisdiction rather
than filed as flatly "public domain". The divine name requires per-tradition
rendering policy (יהוה / LORD / HaShem / Adonai) declared at the *edition* level,
never silently normalised.

---

## 2. Qur'ān

**Reference system:** `quran:sura:ayah`. 114 suras, 6,236 āyāt. Universal.

**Source edition:** the Uthmānī text (public domain), with correct rasm and full
diacritics. Non-negotiable requirements: the Arabic is **immutable** in the data
model, is never normalised for search convenience in the stored form, and is
never displayed with degraded orthography.

**Translations:** Yusuf Ali (1934), Pickthall (1930), Shakir — public domain in
most jurisdictions. Most modern translations are not free; do not assume.

**Tafsīr in PD:** Ibn Kathīr, al-Ṭabarī, Jalālayn, al-Qurṭubī in Arabic. **Note
carefully:** a 14th-century tafsīr is public domain, but a *modern English
translation of it* is a fresh copyrightable work. Licence is tracked per edition,
never per work. This is the single most common licensing mistake in this space.

**Doctrinal requirement in the UI:** translations are labelled as *interpretation
of the meaning*, not as the Qur'ān. This is not a courtesy — it is the mainstream
position of the tradition, and getting it wrong misrepresents the text to its own
readers. The `authority` field on Edition exists for this.

**Why it earns its slot:** it is the hardest case, and therefore the most useful
one to design against. A tradition where recitation is primary, where translation
is categorically secondary, and where the relationship between the two is settled
doctrine will expose every lazy assumption in the architecture — while it is
still cheap to fix.

---

## 3. East Asia → **the Analects (論語, Lúnyǔ)**

**Recommended.**

**Reference system:** `analects:book.chapter` — 20 books, ~512 passages, e.g.
`analects:1.1`. Stable across every edition and translation.

**Why this one:**

- **Commentary as state infrastructure.** Zhu Xi's *Sìshū Zhāngjù Jízhù* (1190)
  was the prescribed reading of the imperial examinations from 1313 until 1905 —
  and in Korea, Japan and Vietnam as well. For six centuries, an entire
  civilisation's governing class was selected on its command of **one specific
  interpretive layer** of this text. There is no cleaner demonstration anywhere
  in history that layers of interpretation are consequential rather than
  decorative.
- **Contestation is sharp and documented.** He Yan's *Jíjiě* (3rd c., Xuanxue
  colouring) → Zhu Xi's Neo-Confucian reading → Dai Zhen and the Qing
  evidential-research scholars attacking Zhu Xi philologically → Ogyū Sorai's
  Japanese *Kogaku* reading against both. Four incompatible programs on the same
  512 passages.
- **Right size** — a first corpus that can be completed rather than sampled.
- **Public domain** throughout: the Chinese text, Legge (1861), Ku Hung-ming
  (1898), and Zhu Xi's commentary in the original.

**Strongest alternative considered — the Dao De Jing.** More translated into
English than any Chinese text; excellent commentaries (Wang Bi, Heshanggong); and
the Mawangdui (168 BCE) and Guodian (c. 300 BCE) manuscript finds would be a
superb stress test of the `variant` layer kind. It loses on the brief's own
criterion — "a basis for Asians". Confucianism, not Daoism, is the shared
substrate across China, Korea, Japan and Vietnam. **Now resolved: both are in
the corpus** (§5), and the Dao De Jing is promoted early in the build order
specifically to exercise variant handling.

**Alternative considered — a Buddhist sūtra** (Lotus, Heart, Diamond). Genuinely
pan-Asian and enormously commented, but the canon is a translation-chain problem
(Sanskrit → Chinese → Tibetan → Japanese, each layer authoritative for a
different community) that the architecture should earn its way up to, not open
with.

---

## 4. India → **the Bhagavad Gītā**

**Recommended, and the strongest fit of all four to the product thesis.**

**Reference system:** `gita:chapter.verse` — 18 chapters, 700 verses.

**Why this one:**

The Gītā is the closest thing that exists to a controlled experiment in
interpretation. Fixed text, 700 verses, and a documented chain of commentators
who each read it into a completely different program:

| Commentator | Date | Reads the Gītā as |
|---|---|---|
| Śaṅkara | 8th c. | Advaita — action purifies the mind; knowledge (*jñāna*) liberates |
| Rāmānuja | 11th c. | Viśiṣṭādvaita — devotion (*bhakti*) to a personal Lord is the path |
| Madhva | 13th c. | Dvaita — soul and God are irreducibly distinct |
| Jñāneśvar | 13th c. | Vernacular Marathi *ovī* — scripture opened to non-Sanskritists |
| Tilak | 1915 | *Karmayoga* — a mandate for political action, written in prison |
| Gandhi | 1929 | *Anāsakti Yoga* — non-attachment as inseparable from *ahiṃsā* |
| Aurobindo | 1922 | Integral yoga — evolutionary spiritual transformation |

**The killer demonstration is verse 2.47.** Twelve words. Śaṅkara takes it toward
renunciation; Tilak takes the same words as a direct command to act in the world
and builds an independence movement on them; Gandhi takes them as the ground of
non-violent resistance. Three readings, mutually exclusive, each rigorous, each
world-changing. Put those three layers on one verse with a toggle and the entire
product explains itself in about four seconds.

It is also self-referentially apt: the Gītā *is* a text about how to read your
situation.

**Public domain:** Sanskrit throughout; Telang (SBE, 1882), Edwin Arnold (1885),
Besant, Sivananda; Śaṅkara's *bhāṣya* in Sanskrit, with older English
translations of it PD.

**Alternatives considered.** The *Upaniṣads* are more philosophically foundational
and carry Śaṅkara's finest commentary, but they are a corpus rather than a book,
with no single stable citation grammar across all of them. **Now resolved: they
are in the corpus too** (§6), with a Bible-shaped reference grammar. The
*Rāmāyaṇa* and *Mahābhārata* are civilisationally central but too
large for a first corpus and have a regional-recension problem that would put the
`variant` machinery on the critical path immediately. The *Yoga Sūtras* are
compact and heavily commented but narrower in reach.

---

## 5. East Asia, second → **the Dao De Jing (道德經)**

**Added alongside the Analects, not instead of it.**

**Reference system:** `daodejing:chapter` — 81 chapters.

**Why it earns a slot rather than duplicating the Analects:**

- **It is the opposition, not the echo.** Confucian and Daoist readings of what a
  life is for are the central argument of Chinese thought. Holding both means the
  corpus contains that argument rather than one side of it.
- **It is the best variant-layer material in existence.** The Mawangdui silk
  manuscripts (168 BCE) and the Guodian bamboo slips (c. 300 BCE) differ from the
  received text in order and in wording. One example already in the sample data:
  the received text's 常 (*cháng*, constant) appears as 恆 (*héng*) at Mawangdui,
  because 恆 was the personal name of Emperor Wen of Han and scribes replaced it
  under naming taboo. **A single character in the most-translated Chinese text in
  the world, altered by an emperor's name — and inherited silently by every
  translation since.** No other work in the corpus makes the case for the
  `variant` layer kind so sharply.
- **Its two great commentaries genuinely disagree.** Wang Bi (3rd c.) reads
  chapter 1 as metaphysics: language cannot reach the Dao. Heshang Gong (2nd c.)
  reads the same seven characters as a manual of self-cultivation and long life.
  Same characters, different book.

**Public domain:** Chinese text, Legge (1891), Wang Bi and Heshang Gong in the
original.

---

## 6. India, second → **the Principal Upaniṣads**

**Added alongside the Gītā.**

**Reference system:** `upanishad:CODE.section[.subsection[.verse]]` — a short code
per Upaniṣad plus a numeric path, e.g. `upanishad:ISH.1`,
`upanishad:BAU.1.3.28`. Structurally this is the Bible's problem, so it takes the
Bible's solution: a corpus of separate books under one reference grammar.

**Why this rather than the Yoga Sūtras or the Rāmāyaṇa:**

- **It is the source the Gītā is arguing from.** Holding both lets a reader follow
  a doctrine back to where it starts.
- **Śaṅkara commented on ten of them and on the Gītā.** The same commentator
  across two works is a real test of author-level navigation — *show me
  everything Śaṅkara says about renunciation, in both books* — and it is the
  first feature that no existing product offers.
- **Īśā 1 is the sharpest contested anchor in the whole seed corpus.** *tena
  tyaktena bhuñjīthāḥ*: Śaṅkara reads renunciation; Aurobindo reads the sentence's
  own main verb — *enjoy* — and argues the renunciatory reading contradicts it.
  This is the **same argument, between the same two positions, as Gītā 2.47**, on
  a different text. Because `stance` is a first-class field, that resonance is
  computable rather than something a scholar has to notice. It is the clearest
  demonstration of why the corpus should hold pairs.

**Cost of admission:** the Upaniṣads are a corpus, not a book, so the reference
grammar needs a code table before ingestion, and unit counts are approximate
until the ten principal texts are actually loaded.

**Public domain:** Sanskrit throughout; Max Müller (SBE, 1879), Telang; Śaṅkara's
bhāṣyas in Sanskrit.

---

## Summary

| # | Work | CR grammar | Units | Original | First imported layers |
|---|---|---|---|---|---|
| 1 | Bible | `bible:BOOK.ch.v` | 31,102 | Hebrew, Greek | Bereshit Rabbah, Masorah, Matthew Henry |
| 2 | Qur'ān | `quran:s:a` | 6,236 | Arabic | Ibn Kathīr, Jalālayn |
| 3 | Analects | `analects:b.c` | ~512 | Classical Chinese | Zhu Xi, He Yan |
| 4 | Dao De Jing | `daodejing:ch` | 81 | Classical Chinese | Wang Bi, Heshang Gong, Mawangdui |
| 5 | Bhagavad Gītā | `gita:ch.v` | 700 | Sanskrit | Śaṅkara, Rāmānuja, Tilak, Gandhi |
| 6 | Principal Upaniṣads | `upanishad:CODE.n` | ~1,350 | Sanskrit | Śaṅkara, Aurobindo |

**Suggested build order: Gītā → Dao De Jing → Analects → Upaniṣads → Qur'ān →
Bible.**

The Gītā first: smallest complete corpus, most vivid contestation, cleanest
licensing, and Devanāgarī combining marks already exercise grapheme alignment.
Then the Dao De Jing, promoted to second because at 81 chapters it is the
cheapest possible way to build the `variant` layer machinery against real
manuscript evidence — and every later work needs that machinery. Then the
Analects for a second non-alphabetic script, the Upaniṣads for multi-book
reference grammars, the Qur'ān because RTL plus immutability plus doctrinal
labelling is the real test, and the Bible last.

That order is deliberately the reverse of what a Western-market instinct would
choose, and it is the right one on engineering grounds: **build against the
hardest constraints while changing them is still cheap.** The Bible is last
precisely because so many tools already handle it that it teaches you least
about whether the architecture is right.
