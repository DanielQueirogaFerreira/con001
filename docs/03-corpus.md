# 03 — The Corpus: which four books, and why

The brief fixed two (Bible, Qur'ān) and left two open: "a book that is a lot of
interpretation and is a basis for Asians", plus one for India. Note that India is
of course in Asia — the distinction being drawn is **East Asia** and **South
Asia**, and that is how it is resolved here.

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
substrate across China, Korea, Japan and Vietnam. **Recommendation: Analects
first, Dao De Jing as the fifth work**, specifically to exercise variant
handling.

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
with no single stable citation grammar across all of them — better as work five
or six. The *Rāmāyaṇa* and *Mahābhārata* are civilisationally central but too
large for a first corpus and have a regional-recension problem that would put the
`variant` machinery on the critical path immediately. The *Yoga Sūtras* are
compact and heavily commented but narrower in reach.

---

## Summary

| # | Work | CR grammar | Units | Original | First imported layers |
|---|---|---|---|---|---|
| 1 | Bible | `bible:BOOK.ch.v` | 31,102 | Hebrew, Greek | Rashi, Matthew Henry |
| 2 | Qur'ān | `quran:s:a` | 6,236 | Arabic | Ibn Kathīr, Jalālayn |
| 3 | Analects | `analects:b.c` | ~512 | Classical Chinese | Zhu Xi, He Yan |
| 4 | Bhagavad Gītā | `gita:ch.v` | 700 | Sanskrit | Śaṅkara, Rāmānuja, Tilak, Gandhi |

**Suggested build order: Gītā first.** It is the smallest complete corpus, it has
the most vivid contestation, its licensing is the cleanest, and its script
(Devanāgarī with combining marks) already exercises the grapheme-alignment
requirement. Then the Analects, for a second non-alphabetic script. Then the
Qur'ān, because RTL plus immutability plus doctrinal labelling is the real test.
Then the Bible, which is the largest and — because so many tools already handle
it — the least informative about whether the architecture is right.

That order is deliberately the reverse of what a Western-market instinct would
choose, and it is the right one on engineering grounds: **build against the
hardest constraints while changing them is still cheap.**
