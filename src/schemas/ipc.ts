import { z } from "zod"

import { KodelyCodeEventName, kodelyCodeEventsSchema, kodelyCodeSettingsSchema } from "./index"

/**
 * Ack
 */

export const ackSchema = z.object({
	clientId: z.string(),
	pid: z.number(),
	ppid: z.number(),
})

export type Ack = z.infer<typeof ackSchema>

/**
 * TaskCommand
 */

export enum TaskCommandName {
	StartNewTask = "StartNewTask",
	CancelTask = "CancelTask",
	CloseTask = "CloseTask",
}

export const taskCommandSchema = z.discriminatedUnion("commandName", [
	z.object({
		commandName: z.literal(TaskCommandName.StartNewTask),
		data: z.object({
			configuration: kodelyCodeSettingsSchema,
			text: z.string(),
			images: z.array(z.string()).optional(),
			newTab: z.boolean().optional(),
		}),
	}),
	z.object({
		commandName: z.literal(TaskCommandName.CancelTask),
		data: z.string(),
	}),
	z.object({
		commandName: z.literal(TaskCommandName.CloseTask),
		data: z.string(),
	}),
])

export type TaskCommand = z.infer<typeof taskCommandSchema>

/**
 * TaskEvent
 */

export const taskEventSchema = z.discriminatedUnion("eventName", [
	z.object({
		eventName: z.literal(KodelyCodeEventName.Message),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.Message],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskCreated),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskCreated],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskStarted),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskStarted],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskModeSwitched),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskModeSwitched],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskPaused),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskPaused],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskUnpaused),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskUnpaused],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskAskResponded),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskAskResponded],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskAborted),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskAborted],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskSpawned),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskSpawned],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskCompleted),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskCompleted],
	}),
	z.object({
		eventName: z.literal(KodelyCodeEventName.TaskTokenUsageUpdated),
		payload: kodelyCodeEventsSchema.shape[KodelyCodeEventName.TaskTokenUsageUpdated],
	}),
])

export type TaskEvent = z.infer<typeof taskEventSchema>

/**
 * IpcMessage
 */

export enum IpcMessageType {
	Connect = "Connect",
	Disconnect = "Disconnect",
	Ack = "Ack",
	TaskCommand = "TaskCommand",
	TaskEvent = "TaskEvent",
}

export enum IpcOrigin {
	Client = "client",
	Server = "server",
}

export const ipcMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(IpcMessageType.Ack),
		origin: z.literal(IpcOrigin.Server),
		data: ackSchema,
	}),
	z.object({
		type: z.literal(IpcMessageType.TaskCommand),
		origin: z.literal(IpcOrigin.Client),
		clientId: z.string(),
		data: taskCommandSchema,
	}),
	z.object({
		type: z.literal(IpcMessageType.TaskEvent),
		origin: z.literal(IpcOrigin.Server),
		relayClientId: z.string().optional(),
		data: taskEventSchema,
	}),
])

export type IpcMessage = z.infer<typeof ipcMessageSchema>
