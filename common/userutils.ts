import { Role } from "./models/types";

export function canKickUser(yourRole: Role, targetRole: Role) {
	return yourRole === Role.Owner || (yourRole > targetRole && targetRole !== Role.Owner);
}
