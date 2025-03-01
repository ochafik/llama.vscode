import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useEvent } from "react-use"
import { Configuration } from "../configuration"
import type { WebviewApi } from "vscode-webview"
import { AssistantMessage } from "../messages";
import { config } from "process";
import { ChatCompletionMessage } from "openai/resources";

export type SessionMessage = {
	createdAt: number,
	message: ChatCompletionMessage,
}
export type Session = {
	startedAt: number,
	messages: SessionMessage[],
}

export type StateType = {
	session: Session,
	sessionHistory: Session[],
}
export type StateContextType = {
	configuration: Configuration,
	setConfiguration: (configuration: Configuration) => void,
	state: StateType,
	setState: (state: StateType) => void,
}
export const StateContext = createContext<StateContextType | undefined>(undefined)

export const vscode = acquireVsCodeApi<StateType>()

export const StateContextProvider: React.FC<{
	children: React.ReactNode
}> = ({ children }) => {
	const [configuration, setConfiguration] = useState<Configuration>();

  useEvent("message", useCallback((event: MessageEvent) => {
		const message: AssistantMessage = event.data
		switch (message.type) {
			case "configuration": {
				setConfiguration(message.configuration)
				break
			}
		}
	}, []))

	useEffect(() => {
		vscode.postMessage({ type: "webviewDidLaunch" })
	}, [])

	if (!configuration) {
		// TODO: loading message
		return null
	}

	let [state, setStateReact] = useState<StateType>();
	if (!state) {
		state = vscode.getState() ?? {
			session: {
				startedAt: Date.now(),
				messages: [],
			},
			sessionHistory: [],
		};
		setStateReact(state);
	}
	const setState = (state: StateType) => {
		setStateReact(state);
		vscode.setState(state);
	};

	const stateContextValue = {
		configuration,
		setConfiguration,
		state,
		setState,
	}

	return <StateContext.Provider value={stateContextValue}>{children}</StateContext.Provider>
}
