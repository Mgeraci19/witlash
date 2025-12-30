import { Doc } from "../../convex/_generated/dataModel";

export type GameState = Doc<"games"> & {
    players: Doc<"players">[];
    messages: Doc<"messages">[];
    prompts: Doc<"prompts">[];
    submissions: Doc<"submissions">[];
    votes: Doc<"votes">[];
    suggestions: Doc<"suggestions">[];
};
