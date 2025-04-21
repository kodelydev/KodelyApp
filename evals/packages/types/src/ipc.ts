import { z } from "zod"

import { KodelyEventName, kodelyEventsSchema, kodelySettingsSchema } from "./kodely.js"

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
			configuration: kodelySettingsSchema,
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

export enum EvalEventName {
	Pass = "pass",
	Fail = "fail",
}

export const taskEventSchema = z.discriminatedUnion("eventName", [
	z.object({
		eventName: z.literal(KodelyEventName.Message),
		payload: kodelyEventsSchema.shape[KodelyEventName.Message],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskCreated),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskCreated],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskStarted),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskStarted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskModeSwitched),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskModeSwitched],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskPaused),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskPaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskUnpaused),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskUnpaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskAskResponded),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskAskResponded],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskAborted),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskAborted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskSpawned),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskSpawned],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskCompleted),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(KodelyEventName.TaskTokenUsageUpdated),
		payload: kodelyEventsSchema.shape[KodelyEventName.TaskTokenUsageUpdated],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(EvalEventName.Pass),
		payload: z.undefined(),
		taskId: z.number(),
	}),
	z.object({
		eventName: z.literal(EvalEventName.Fail),
		payload: z.undefined(),
		taskId: z.number(),
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
	EvalEvent = "EvalEvent",
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
