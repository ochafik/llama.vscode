import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useEvent } from "react-use"
import { Configuration } from "../configuration"
import type { WebviewApi } from "vscode-webview"
import { AssistantMessage } from "../messages";
import { config } from "process";
import { ChatCompletionMessage, ChatCompletionMessageParam } from "openai/resources";

export type SessionMessage = {
	createdAt: number,
	message: ChatCompletionMessage | ChatCompletionMessageParam
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
	postMessage: (message: AssistantMessage) => void,
}
export const StateContext = createContext<StateContextType | undefined>(undefined)

// Safely acquire the VSCode API in a way that works in both the webview and during testing/development
export const getVSCodeAPI = () => {
  // Check if we're in a webview context
  if (typeof acquireVsCodeApi === 'function') {
    // Use a try-catch to handle any potential errors
    try {
      return acquireVsCodeApi<StateType>();
    } catch (error) {
      console.error('Failed to acquire VS Code API:', error);
    }
  }
  
  // Return a mock implementation for non-webview environments
  return {
    postMessage: (message: any) => {
      console.log('Mock postMessage:', message);
    },
    getState: () => null,
    setState: (state: any) => {
      console.log('Mock setState:', state);
    }
  };
};

export const StateContextProvider: React.FC<{
	children: React.ReactNode
}> = ({ children }) => {
	// Initialize VSCode API at the top level - use function initializer to ensure it's only called once
	const [vscodeApi] = useState(() => getVSCodeAPI());
	
	// Initialize configuration state
	const [configuration, setConfiguration] = useState<Configuration>();
	
	// Initialize state with default values
	const defaultState: StateType = {
		session: {
			startedAt: Date.now(),
			messages: [],
		},
		sessionHistory: [],
	};
	
	// Initialize state at the top level
	const [state, setStateReact] = useState<StateType>(() => {
		const savedState = vscodeApi.getState();
		return savedState ?? defaultState;
	});
	
	// Function to update state
	const setState = (newState: StateType) => {
		setStateReact(newState);
		vscodeApi.setState(newState);
	};

	// Handle messages from the extension
	useEvent("message", useCallback((event: MessageEvent) => {
		const message: AssistantMessage = event.data
		switch (message.type) {
			case "configuration": {
				setConfiguration(message.configuration)
				break
			}
		}
	}, []))

	// Send webviewDidLaunch message when the component mounts
	useEffect(() => {
		vscodeApi.postMessage({ type: "webviewDidLaunch" })
	}, [vscodeApi])

	// If configuration is not yet available, render a loading state
	if (!configuration) {
		// TODO: loading message
		return null
	}

	// Create the context value
	const stateContextValue: StateContextType = {
		configuration,
		setConfiguration,
		state,
		setState,
		postMessage: (message: AssistantMessage) => vscodeApi.postMessage(message),
	}

	return <StateContext.Provider value={stateContextValue}>{children}</StateContext.Provider>
}
