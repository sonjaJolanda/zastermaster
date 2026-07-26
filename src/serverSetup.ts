import express from "express";
import type { MiddlewareConfigFn } from "wasp/server";

/** Allow large bank CSV payloads inside operation JSON bodies. */
export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set("express.json", express.json({ limit: "10mb" }));
  return middlewareConfig;
};
