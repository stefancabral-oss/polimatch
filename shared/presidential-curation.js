export const PRESIDENTIAL_CATEGORY_PREFIX = "corrida-";
export const PRESIDENTIAL_EXCLUSIONS = Object.freeze([
  "michelle-bolsonaro",
  "jair-bolsonaro",
  "eduardo-bolsonaro",
  "romeu-zema",
]);

export function validatePresidentialRoster(
  roster,
  { requirePhotos = true } = {},
) {
  if (
    roster?.schemaVersion !== 1 ||
    roster.authorizationIssue !== 249 ||
    !Array.isArray(roster.categories) ||
    roster.categories.length !== 6 ||
    !Array.isArray(roster.people) ||
    !roster.people.length
  )
    throw new TypeError("Curadoria presidencial inválida");
  const ids = new Set(),
    slots = new Set(),
    topics = new Set();
  for (const person of roster.people) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(person.id) ||
      ids.has(person.id) ||
      PRESIDENTIAL_EXCLUSIONS.includes(person.id) ||
      !person.name?.trim() ||
      !Number.isSafeInteger(person.personId) ||
      person.personId < 1 ||
      slots.has(person.personId) ||
      !Array.isArray(person.memberships) ||
      !person.memberships.length
    )
      throw new TypeError(`Identidade inválida: ${person.id}`);
    ids.add(person.id);
    slots.add(person.personId);
    if (person.photo) {
      if (
        !/^\/portraits\/(?:\d{3}\.jpg|presidential\/[a-z0-9-]+\.(?:jpg|webp|png|svg))$/.test(
          person.photo.path,
        ) ||
        !/^[a-f0-9]{64}$/.test(person.photo.sha256) ||
        !person.photo.source ||
        !person.photo.credit
      )
        throw new TypeError(`Retrato inválido: ${person.id}`);
      if (
        person.photo.position &&
        !/^(?:center|\d{1,3}% \d{1,3}%)$/.test(person.photo.position)
      )
        throw new TypeError(`Enquadramento inválido: ${person.id}`);
      if (
        person.photo.rotation &&
        ![-90, 90, 180].includes(person.photo.rotation)
      )
        throw new TypeError(`Orientação inválida: ${person.id}`);
      if (
        person.photo.crop &&
        (![
          person.photo.crop.x,
          person.photo.crop.y,
          person.photo.crop.width,
        ].every(Number.isFinite) ||
          person.photo.crop.x < 0 ||
          person.photo.crop.y < 0 ||
          person.photo.crop.y >= 1 ||
          person.photo.crop.width <= 0 ||
          person.photo.crop.x + person.photo.crop.width > 1)
      )
        throw new TypeError(`Recorte inválido: ${person.id}`);
      if (
        person.photo.crop?.height !== undefined &&
        (!Number.isFinite(person.photo.crop.height) ||
          person.photo.crop.height <= 0 ||
          person.photo.crop.y + person.photo.crop.height > 1 ||
          !Number.isSafeInteger(person.photo.width) ||
          !Number.isSafeInteger(person.photo.height) ||
          person.photo.width <= 0 ||
          person.photo.height <= 0)
      )
        throw new TypeError(`Janela de retrato inválida: ${person.id}`);
      if (person.photo.fit && !["cover", "contain"].includes(person.photo.fit))
        throw new TypeError(`Ajuste de retrato inválido: ${person.id}`);
    } else if (requirePhotos)
      throw new TypeError(`Retrato ausente: ${person.id}`);
    for (const membership of person.memberships) {
      if (
        !["lula", "flavio"].includes(membership.support) ||
        !/^https:\/\//.test(membership.sourceUrl)
      )
        throw new TypeError(`Fonte ausente: ${person.id}`);
    }
  }
  for (const category of roster.categories) {
    if (
      category.topicId !== `${PRESIDENTIAL_CATEGORY_PREFIX}${category.id}` ||
      topics.has(category.topicId) ||
      !category.name?.trim() ||
      !Array.isArray(category.members)
    )
      throw new TypeError("Categoria inválida");
    topics.add(category.topicId);
    const seen = new Set();
    for (const member of category.members) {
      const key = `${member.id}:${member.support}`;
      const person = roster.people.find((p) => p.id === member.id);
      if (
        seen.has(key) ||
        !person ||
        !person.memberships.some(
          (m) => m.category === category.id && m.support === member.support,
        )
      )
        throw new TypeError("Vínculo de categoria inválido");
      seen.add(key);
    }
    if (new Set(category.members.map((m) => m.id)).size < 4)
      throw new TypeError("Categoria sem quatro identidades");
  }
  for (const person of roster.people)
    for (const m of person.memberships) {
      if (
        !roster.categories.some(
          (c) =>
            c.id === m.category &&
            c.members.some(
              (member) =>
                member.id === person.id && member.support === m.support,
            ),
        )
      )
        throw new TypeError("Vínculo órfão");
    }
  return roster;
}

export function categoryPeople(roster, categoryId) {
  const category = roster.categories.find(
    (c) => c.id === categoryId || c.topicId === categoryId,
  );
  if (!category) return [];
  const ids = new Set(category.members.map((m) => m.id));
  return roster.people.filter((p) => ids.has(p.id));
}

export function supportLabel(person, categoryId) {
  const supports = new Set(
    person.memberships
      .filter((m) => !categoryId || m.category === categoryId)
      .map((m) => m.support),
  );
  return !supports.size
    ? "Participação na curadoria"
    : supports.size > 1
      ? "Apoio documentado aos dois"
      : supports.has("lula")
        ? "Apoia Lula"
        : "Apoia Flávio";
}
