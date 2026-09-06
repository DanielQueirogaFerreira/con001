// The Studio prompt compiler: the output side of the Director Lens Hook.
//
//   compile({ anchor, lenses, oppositions, policy }) -> generation payload(s)
//
// Deliberately dependency-free AND import-free, because tools/build-reader.mjs
// inlines this exact source into web/reader.html. One implementation, tested in
// Node, executed in the browser. (Named prompt-compiler.mjs rather than
// prompt_compiler.mjs to match every other tool in this directory.)
//
// THE RULE THAT SHAPES EVERYTHING HERE: it will not merge contending readings.
// If two active lenses are in recorded opposition — one rebuts the other in the
// fork graph — the compiler emits ONE PAYLOAD PER FACTION and refuses to
// produce a blend. An image that splits the difference between Śaṅkara and
// Tilak represents no reading at all, and the blurry-compromise output is the
// characteristic failure of prompt-merging. The caller must choose a reading.

export const ASPECTS = { intimate: '4:5', scene: '3:2', vast: '16:9', icon: '1:1' };

// Derived from the reading's own register when the layer does not state one.
// Keyword tables, not inference: a curator can read and correct this.
const CAMERA_HINTS = [
  [/interior|withdrawn|apophatic|stillness/i, { camera: 'static, long lens, shallow depth', aspect: ASPECTS.intimate, lighting: 'diffuse, sourceless, low contrast' }],
  [/kinetic|engaged|movement|forward/i, { camera: 'handheld, mid shot, subject in motion', aspect: ASPECTS.scene, lighting: 'hard directional, high contrast' }],
  [/narrative|scene|occasion|story/i, { camera: 'observational wide, eye level', aspect: ASPECTS.scene, lighting: 'daylight, unremarkable' }],
  [/calligraphic|geometric|letterform|pattern/i, { camera: 'flat-on, no perspective', aspect: ASPECTS.icon, lighting: 'even, no modelling' }],
  [/restrained|ascetic|plain|bodily/i, { camera: 'close, plain framing', aspect: ASPECTS.intimate, lighting: 'available light, unstyled' }],
  [/vast|unbroken|single field|expansive/i, { camera: 'wide, distant horizon', aspect: ASPECTS.vast, lighting: 'ambient, no source' }],
  [/social|relational|formal|measured/i, { camera: 'balanced group framing, eye level', aspect: ASPECTS.scene, lighting: 'even, formal' }],
];

function cameraFor(direction) {
  if (direction.camera || direction.aspect || direction.lighting)
    return {
      camera: direction.camera ?? 'unspecified',
      aspect: direction.aspect ?? ASPECTS.scene,
      lighting: direction.lighting ?? 'unspecified',
    };
  for (const [re, spec] of CAMERA_HINTS) if (re.test(direction.register)) return spec;
  return { camera: 'neutral mid shot', aspect: ASPECTS.scene, lighting: 'even' };
}

// Small deterministic hash so an identical reading compiles to an identical id,
// which is what makes rendition caching by (anchor, lens, prompt) work.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Split the active lenses into factions that do not contradict each other.
// Opposition comes from the fork graph (`rebuts` / `questions`), never guessed
// from wording.
function faction(lensIds, oppositions) {
  const opposed = new Map(lensIds.map((id) => [id, new Set()]));
  for (const o of oppositions ?? []) {
    if (!opposed.has(o.from) || !opposed.has(o.to)) continue;
    opposed.get(o.from).add(o.to);
    opposed.get(o.to).add(o.from);
  }
  const groups = [];
  for (const id of lensIds) {
    const fit = groups.find((g) => g.every((other) => !opposed.get(id).has(other)));
    if (fit) fit.push(id); else groups.push([id]);
  }
  return groups;
}

export function compile({ anchor, lenses = [], oppositions = [], policy = {}, subject = '' } = {}) {
  const withDirection = lenses.filter((l) => l && l.direction);

  if (!withDirection.length)
    return { anchor, decision: 'nothing-to-compile', reason: 'no active lens carries a direction', payloads: [] };

  // 1. POLICY FIRST, before a single word of prompt is composed. A prompt you
  //    will not run should not exist. See docs/04-generative.md.
  const figuralBlocked = withDirection.filter((l) => l.direction.figural === 'blocked');
  const hardBlocks = [];
  if (figuralBlocked.length)
    hardBlocks.push({
      rule: 'no-figural-depiction',
      by: figuralBlocked.map((l) => l.id),
      note: 'Corpus policy. No user override, evaluated before generation. The negatives it adds are locked.',
    });
  for (const rule of policy.hard_blocks ?? [])
    hardBlocks.push({ rule: rule.id, by: ['policy'], note: rule.note ?? '' });

  if (policy.generation === 'blocked')
    return {
      anchor,
      decision: 'blocked',
      blocks: hardBlocks.length ? hardBlocks : [{ rule: 'corpus-generation-blocked', by: ['policy'] }],
      payloads: [],
      note: 'Generation is blocked for this corpus. No prompt was composed. A refusal names the rule that applied and is appealable to a human.',
    };

  const lockedNegatives = figuralBlocked.length
    ? ['any figural depiction', 'human or divine figures', 'representation of prophets', 'anthropomorphic imagery']
    : [];

  // 2. Split into factions that do not contradict each other.
  const byId = Object.fromEntries(withDirection.map((l) => [l.id, l]));
  const groups = faction(withDirection.map((l) => l.id), oppositions);

  const payloads = groups.map((ids) => {
    const ls = ids.map((id) => byId[id]);
    const spec = cameraFor(ls[0].direction);

    const motifs = [...new Set(ls.flatMap((l) => l.direction.motifs))];
    const authored = [...new Set(ls.flatMap((l) => l.direction.avoid))];

    // 3. THE NEGATIVE LIST WINS. A motif one active lens calls for that another
    //    positively excludes is dropped from the positive prompt, not argued
    //    with. Exclusions are the sharper statement of a reading.
    const excluded = new Set();
    const key = (w) => w.toLowerCase().split(/\W+/).filter((x) => x.length > 4);
    const kept = motifs.filter((mo) => {
      const hit = authored.some((av) => key(mo).some((w) => key(av).includes(w)));
      if (hit) excluded.add(mo);
      return !hit;
    });

    const positive = [
      subject || `${anchor}, as read through ${ls.map((l) => l.author.display).join(' and ')}`,
      ...kept,
      ls.map((l) => l.direction.register).join('; '),
      [...new Set(ls.map((l) => l.direction.palette).filter(Boolean))].join('; '),
      spec.lighting,
      spec.camera,
    ].filter(Boolean).join(', ');

    const negative = [...new Set([...lockedNegatives, ...authored])];

    const body = {
      anchor,
      lenses: ids,
      positive,
      negative,
      locked_negative: lockedNegatives,
      lighting: spec.lighting,
      camera: spec.camera,
      aspect: spec.aspect,
      dropped_from_positive: [...excluded],
    };
    return { id: 'pl:' + fnv1a(JSON.stringify(body)), ...body };
  });

  const conflicts = (oppositions ?? [])
    .filter((o) => byId[o.from] && byId[o.to])
    .map((o) => ({
      relation: o.relation,
      from: byId[o.from].author.display,
      to: byId[o.to].author.display,
      note: `${byId[o.from].author.display} ${o.relation} ${byId[o.to].author.display} — these direct different images.`,
    }));

  return {
    anchor,
    decision: 'compiled',
    contending: payloads.length > 1,
    blocks: hardBlocks,
    conflicts,
    payloads,
    note: payloads.length > 1
      ? 'These lenses are in recorded opposition, so the compiler produced one payload per reading and did NOT merge them. Choose a reading; a blend represents none of them.'
      : 'Every rendition carries its lens, so the output is attributed to a reading and never to the text.',
  };
}

// Convenience for callers holding the raw corpus: derive fork-graph oppositions
// between the layers active at an anchor.
export function oppositionsAt(interps, anchorCr) {
  const here = interps.filter((i) => i.anchor.cr === anchorCr);
  const byId = Object.fromEntries(here.map((i) => [i.id, i]));
  const out = [];
  for (const i of here) {
    if (!['rebuts', 'questions'].includes(i.relation)) continue;
    for (const pid of i.derived_from ?? []) {
      const parent = byId[pid];
      if (parent) out.push({ from: i.layer, to: parent.layer, relation: i.relation });
    }
  }
  return out;
}
