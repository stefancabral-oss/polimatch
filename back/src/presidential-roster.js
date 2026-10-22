import { createHash } from "node:crypto";
import {
  categoryPeople,
  validatePresidentialRoster,
} from "../../shared/presidential-curation.js";

// Curadoria nominal autorizada na #249. Não promove biografias pendentes nem
// reusa o rótulo "approved" para fotografias novas ainda sujeitas ao gate visual.
export function withPresidentialRoster(base, roster, loadFile) {
  validatePresidentialRoster(roster);
  const people = new Map();
  for (const person of roster.people) {
    const bytes = loadFile(`app/public${person.photo.path}`);
    if (
      createHash("sha256").update(bytes).digest("hex") !== person.photo.sha256
    )
      throw new Error(`Retrato presidencial alterado: ${person.id}`);
    const ambiguous = {
      status: "ambiguous",
      source: "Não classificado nesta curadoria nominal",
    };
    const candidate = {
      id: person.id,
      personId: person.personId,
      name: person.name,
      displayName: person.name,
      role: "Pessoa pública",
      party: null,
      primaryArea: null,
      contextAffiliation: null,
      taxonomyProvenance: {
        role: {
          status: "extracted",
          source: "Curadoria nominal autorizada na issue #249",
        },
        party: ambiguous,
        primaryArea: ambiguous,
        contextAffiliation: ambiguous,
      },
      group: "curadoria",
      location: "Não informado",
      summary: "Participante da curadoria da corrida presidencial.",
      bio: "Curadoria nominal. A participação não representa pesquisa eleitoral nem aprovação do perfil biográfico.",
      relevance2026:
        "Fontes de participação disponíveis no elenco desta edição.",
      facts: [],
      highlight: "Não apresentado nesta curadoria nominal.",
      controversy: "Não apresentado nesta curadoria nominal.",
      sources: [],
      photo: person.photo.path,
      cardArt: "",
      reviewStatus: "pending",
      reviewedAt: "",
      eligible: true,
      topicIds: roster.categories
        .filter((c) => c.members.some((m) => m.id === person.id))
        .map((c) => c.topicId),
      publication: {
        content: { status: "pending", reviewedAt: "" },
        cardArt: { status: "missing", image: "", version: "" },
        documentaryPhoto: {
          status: "curated",
          image: person.photo.path,
          source: person.photo.sourceUrl,
          license: person.photo.credit,
        },
      },
    };
    people.set(person.id, Object.freeze(candidate));
  }
  const topics = Object.freeze([
    ...base.topics,
    ...roster.categories.map((c) =>
      Object.freeze({
        id: c.topicId,
        name: c.name,
        description: c.description,
        active: true,
        status: "curated",
      }),
    ),
  ]);
  const byTopic = new Map(topics.map((t) => [t.id, t]));
  const baseIds = new Set(base.candidates.map((p) => p.id));
  const candidates = Object.freeze([
    ...base.candidates,
    ...[...people.values()].filter((p) => !baseIds.has(p.id)),
  ]);
  const lookup = new Map(candidates.map((p) => [p.id, p]));
  for (const [id, person] of people)
    if (!lookup.has(id)) lookup.set(id, person);
  return Object.freeze({
    ...base,
    candidates,
    topics,
    topicsById: Object.freeze({
      get: (id) => byTopic.get(id),
      has: (id) => byTopic.has(id),
      values: () => byTopic.values(),
    }),
    candidatesById: Object.freeze({
      get: (id) => lookup.get(id),
      has: (id) => lookup.has(id),
    }),
    candidatesForTopic(topicId) {
      const category = roster.categories.find((c) => c.topicId === topicId);
      return category
        ? Object.freeze(
            categoryPeople(roster, category.id).map((p) => people.get(p.id)),
          )
        : base.candidatesForTopic(topicId);
    },
    candidateBelongsToTopic(id, topicId) {
      const category = roster.categories.find((c) => c.topicId === topicId);
      return category
        ? category.members.some((m) => m.id === id)
        : base.candidateBelongsToTopic(id, topicId);
    },
  });
}
