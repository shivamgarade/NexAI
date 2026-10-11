import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import { ROUTES } from '@/constants/routes';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/Auth/RegisterPage'));
const ChatPage = lazy(() => import('@/pages/Chat/ChatPage'));
const LibraryPage = lazy(() => import('@/pages/Library/LibraryPage'));
const DocumentsPage = lazy(() => import('@/pages/Documents/DocumentsPage'));
const SkillsPage = lazy(() => import('@/pages/Skills/SkillsPage'));
const PromptsPage = lazy(() => import('@/pages/Prompts/PromptsPage'));
const InterviewPage = lazy(() => import('@/pages/Interview/InterviewPage'));
const SchemaPage = lazy(() => import('@/pages/Schema/SchemaPage'));
const ProjectPage = lazy(() => import('@/pages/Project/ProjectPage'));
const ProjectsGalleryPage = lazy(() => import('@/pages/Project/ProjectsGalleryPage'));
const SearchPage = lazy(() => import('@/pages/Search/SearchPage'));
const WalletPage = lazy(() => import('@/pages/Wallet/WalletPage'));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'));
const AdminPage = lazy(() => import('@/pages/Admin/AdminPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFound/NotFoundPage'));

// Conditionally import DesignSystemPage only in dev
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/DesignSystem/DesignSystemPage'))
  : null;

const appChildren = [
  { index: true, element: <Navigate to={ROUTES.CHAT} replace /> },
  { path: ROUTES.CHAT, element: <ChatPage /> },
  { path: ROUTES.CHAT_ID, element: <ChatPage /> },
  { path: ROUTES.LIBRARY, element: <LibraryPage /> },
  { path: ROUTES.DOCUMENTS, element: <DocumentsPage /> },
  { path: ROUTES.DOCUMENT_ID, element: <DocumentsPage /> },
  { path: ROUTES.SKILLS, element: <SkillsPage /> },
  { path: ROUTES.PROMPTS, element: <Navigate to={ROUTES.SKILLS} replace /> },
  { path: ROUTES.INTERVIEW, element: <InterviewPage /> },
  { path: ROUTES.SCHEMA, element: <SchemaPage /> },
  { path: ROUTES.PROJECT_ID, element: <ProjectPage /> },
  { path: ROUTES.PROJECTS, element: <ProjectsGalleryPage /> },
  { path: ROUTES.SEARCH, element: <SearchPage /> },
  { path: ROUTES.WALLET, element: <WalletPage /> },
  { path: ROUTES.SETTINGS, element: <SettingsPage /> },
  {
    path: ROUTES.ADMIN,
    element: (
      <AdminRoute>
        <AdminPage />
      </AdminRoute>
    ),
  },
];

// Register /design-system only in development
if (import.meta.env.DEV && DesignSystemPage) {
  appChildren.push({
    path: ROUTES.DESIGN_SYSTEM,
    element: <DesignSystemPage />,
  });
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.REGISTER, element: <RegisterPage /> },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: appChildren,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
