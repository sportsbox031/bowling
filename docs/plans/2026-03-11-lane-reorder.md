# Lane Reorder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorder players within the same lane by swapping assignment array positions instead of lane numbers.

**Architecture:** Extract same-lane reordering into a pure helper and call it from the scoreboard drag-and-drop swap branch. Keep cross-lane swap and game rebuild behavior unchanged.

**Tech Stack:** Next.js 14, React 18, TypeScript, Node built-in assert

---
