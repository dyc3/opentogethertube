import { Grants } from "./permissions.js";

enum Visibility {
	Public,
	Unlisted,
	Private,
}

enum QueueMode {
	Manual,
	Vote,
	Loop,
	Dj,
}

interface RoomContext {

}

class Room {
	Name: string = "";
	Title: string = "";
	Description: string = "";
	IsTemporary: boolean = false;
	Visibility: Visibility = Visibility.Public;
	QueueMode: QueueMode = QueueMode.Manual;
	Grants: Grants = new Grants();
}
