import React, { useCallback } from "react"
import { StateContext, StateContextProvider } from "./state"

const Assistant = () => {
	const context = React.useContext(StateContext)!
	const [input, setInput] = React.useState("")

	// use callback
	const ask = useCallback((text: string) => {
		context.setState({
			...context.state,
			session: {
				...context.state.session,
				messages: [
					...context.state.session.messages,
					{
						createdAt: Date.now(),
						message: {
							role: "user",
							content: text,
						},
					},
				],
			},
		})
	}, [context.state]);
	return (
		<>
			<h1>App Content</h1>
			{context.state.session.messages.map((message, index) => (
				<div key={index}>
					{message.message.role === "user" ? "User: " : "Assistant: "}
					{message.message.content}
				</div>
			))}
			<input type="text" value={input} onChange={(e) => setInput(e.target.value)} />
			<button onClick={() => ask(input)}>Ask</button>
		</>
	)
};

export default () => {
	return (
			<StateContextProvider>
				<Assistant />
			</StateContextProvider>
	)
}