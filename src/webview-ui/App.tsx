import React from "react"
import { StateContext, StateContextProvider } from "./state"

const Assistant = () => {
	const context = React.useContext(StateContext)!
	return (
		<div>
			<h1>App Content</h1>
		</div>
	)
};

export default () => {
	return (
			<StateContextProvider>
				<Assistant />
			</StateContextProvider>
	)
}