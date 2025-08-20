import { Role } from "./models/types.js";

export function canKickUser(yourRole: Role, targetRole: Role) {
	return yourRole === Role.Owner || (yourRole > targetRole && targetRole !== Role.Owner);
}
