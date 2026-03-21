import {
	type CasenPlugin,
	type WorkerJob,
	type WorkerJobResult,
	createWorkerCommand,
} from "@bpmnkit/cli-sdk"

interface JsonPlaceholderUser {
	id: number
	name: string
	email: string
	address: { city: string }
	company: { name: string }
}

async function fetchRandomUser(): Promise<JsonPlaceholderUser> {
	const id = Math.floor(Math.random() * 10) + 1
	const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`)
	if (!res.ok) throw new Error(`HTTP ${res.status} from JSONPlaceholder`)
	return res.json() as Promise<JsonPlaceholderUser>
}

const httpWorkerCommand = createWorkerCommand({
	jobType: "io.camunda.connector.HttpJson:1",
	description: "Subscribe to HTTP connector jobs and complete them with live API data",
	defaultVariables: { result: "sample-value" },
	async processJob(job: WorkerJob): Promise<WorkerJobResult> {
		const user = await fetchRandomUser()
		return {
			outcome: "complete",
			variables: {
				userId: user.id,
				name: user.name,
				email: user.email,
				city: user.address.city,
				company: user.company.name,
				inputVariables: job.variables,
				processedAt: new Date().toISOString(),
			},
		}
	},
})

const plugin: CasenPlugin = {
	id: "com.bpmnkit.casen-worker-http",
	name: "HTTP Worker",
	version: "0.1.0",
	groups: [
		{
			name: "http-worker",
			description: "Process HTTP connector jobs using the JSONPlaceholder API",
			commands: [httpWorkerCommand],
		},
	],
}

export default plugin
