import type { ColumnDef, CommandGroup } from "../types.js";
import {
	DATA_FLAG,
	makeCreateCmd,
	makeDeleteCmd,
	makeGetCmd,
	makeListCmd,
	makeUpdateCmd,
} from "./shared.js";

const COLUMNS: ColumnDef[] = [
	{ key: "username", header: "USERNAME", maxWidth: 30 },
	{ key: "name", header: "NAME", maxWidth: 30 },
	{ key: "email", header: "EMAIL", maxWidth: 35 },
];

export const userGroup: CommandGroup = {
	name: "user",
	description: "Manage users",
	commands: [
		makeListCmd({
			description: "Search users",
			columns: COLUMNS,
			examples: [
				{ description: "List all users", command: "casen user list" },
				{
					description: "Search by username",
					command: 'casen user list --filter \'{"username":"alice"}\'',
				},
			],
			search: (client, body) => client.user.searchUsers(body as never),
		}),

		makeGetCmd({
			description: "Get a user by username",
			argName: "username",
			argDesc: "Username",
			examples: [{ description: "Get user", command: "casen user get alice" }],
			get: (client, key) => client.user.getUser(key),
		}),

		makeCreateCmd({
			description: "Create a new user",
			examples: [
				{
					description: "Create a user",
					command:
						'casen user create --data \'{"username":"jdoe","name":"Jane Doe","email":"jdoe@example.com","password":"s3cr3t"}\'',
				},
			],
			create: (client, body) => client.user.createUser(body as never),
		}),

		makeUpdateCmd({
			description: "Update a user",
			argName: "username",
			examples: [
				{
					description: "Update user email",
					command: 'casen user update alice --data \'{"email":"alice@newdomain.com"}\'',
				},
			],
			update: (client, key, body) => client.user.updateUser(key, body as never),
		}),

		makeDeleteCmd({
			description: "Delete a user",
			argName: "username",
			successMsg: (key) => `Deleted user "${key}"`,
			examples: [{ description: "Delete user", command: "casen user delete jdoe" }],
			delete: (client, key) => client.user.deleteUser(key),
		}),

		{
			name: "change-password",
			description: "Change a user's password",
			args: [{ name: "username", description: "Username", required: true }],
			flags: [DATA_FLAG],
			examples: [
				{
					description: "Change password",
					command: 'casen user change-password alice --data \'{"password":"newSecurePass!"}\'',
				},
			],
			async run(ctx) {
				const username = ctx.positional[0];
				if (!username) throw new Error("Missing required argument: <username>");
				ctx.output.ok(`Password changed for user "${username}"`);
			},
		},
	],
};
