# Loading UX And Route Transition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 공개 페이지는 짧고 부드럽게, 관리자 페이지는 빠르고 간결하게 전환되도록 만들고, 주요 화면에서 빈 상태보다 로딩 스켈레톤과 안내 메시지를 먼저 보여준다.

**Architecture:** 레이아웃에 경량 페이지 전환 래퍼를 추가하고, 공통 로딩/스켈레톤 컴포넌트를 만든다. 라우트 단 `loading.tsx`와 주요 클라이언트 페이지의 상태 분리를 함께 적용해 깜빡임과 조기 empty 메시지를 줄인다.

**Tech Stack:** Next.js App Router, React client components, TypeScript, global CSS
