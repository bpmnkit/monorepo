import { ToastProvider, useToast } from "@cascivo/react"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { QueryClientProvider } from "@tanstack/react-query"
import { useEffect } from "preact/hooks"
import { Route, Router, Switch } from "wouter"
import { queryClient } from "./api/queryClient.js"
import { WelcomeModal } from "./components/WelcomeModal.js"
import { Shell } from "./layout/Shell.js"
import { Dashboard } from "./pages/Dashboard.js"
import { DecisionDetail } from "./pages/DecisionDetail.js"
import { Decisions } from "./pages/Decisions.js"
import { DefinitionDetail } from "./pages/DefinitionDetail.js"
import { Definitions } from "./pages/Definitions.js"
import { IncidentDetail } from "./pages/IncidentDetail.js"
import { Incidents } from "./pages/Incidents.js"
import { InstanceDetail } from "./pages/InstanceDetail.js"
import { Instances } from "./pages/Instances.js"
import { ModelDetail } from "./pages/ModelDetail.js"
import { Models } from "./pages/Models.js"
import { NotFound } from "./pages/NotFound.js"
import { RunHistory } from "./pages/RunHistory.js"
import { Settings } from "./pages/Settings.js"
import { TaskDetail } from "./pages/TaskDetail.js"
import { Tasks } from "./pages/Tasks.js"
import { bindToast } from "./stores/toast.js"

// Bridges cascivo's hook-only `useToast().toast` into the imperative `toast.*`
// helper so non-component call sites can enqueue toasts.
function ToastBridge() {
	const { toast } = useToast()
	useEffect(() => {
		bindToast(toast)
	}, [toast])
	return null
}

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<ToastProvider>
					<ToastBridge />
					<Router>
						<Shell>
							<Switch>
								<Route path="/" component={Dashboard} />
								<Route path="/models" component={Models} />
								<Route path="/models/:id" component={ModelDetail} />
								<Route path="/definitions" component={Definitions} />
								<Route path="/definitions/:key" component={DefinitionDetail} />
								<Route path="/instances" component={Instances} />
								<Route path="/instances/:key" component={InstanceDetail} />
								<Route path="/incidents" component={Incidents} />
								<Route path="/incidents/:key" component={IncidentDetail} />
								<Route path="/tasks" component={Tasks} />
								<Route path="/tasks/:key" component={TaskDetail} />
								<Route path="/decisions" component={Decisions} />
								<Route path="/decisions/:key" component={DecisionDetail} />
								<Route path="/run-history" component={RunHistory} />
								<Route path="/settings" component={Settings} />
								<Route component={NotFound} />
							</Switch>
						</Shell>
					</Router>
					<WelcomeModal />
				</ToastProvider>
			</TooltipProvider>
		</QueryClientProvider>
	)
}
