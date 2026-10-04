import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { CreateProjectModal, ProjectSettingsModal } from '@/features/projects';
import { useProjectStore } from '@/store/projectStore';
import { ROUTES } from '@/constants/routes';
import styles from './ProjectsGalleryPage.module.scss';

export default function ProjectsGalleryPage() {
  const navigate = useNavigate();
  const { projects, isLoading, fetchProjects, deleteProject } = useProjectStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  const handleOpenProject = (id) => {
    navigate(`${ROUTES.PROJECTS}/${id}`);
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    await deleteProject(id);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Projects</h1>

        <div className={styles.headerActions}>
          <div className={styles.searchBox}>
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<Search size={14} />}
              size="sm"
            />
          </div>

          <Button
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => setIsCreateOpen(true)}
          >
            New project
          </Button>
        </div>
      </header>

      {isLoading && projects.length === 0 ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={160} borderRadius="var(--radius-xl)" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className={styles.emptyBox}>
          <Folder size={42} color="var(--color-primary-base)" />
          <h2 className={styles.emptyTitle}>
            {searchQuery ? 'No matching projects found' : 'No projects yet'}
          </h2>
          <p className={styles.emptyDesc}>
            {searchQuery
              ? `No projects matched "${searchQuery}". Try another search query.`
              : 'Create a project workspace to attach local knowledge sources, define custom AI instructions, and organize project chats.'}
          </p>
          {!searchQuery && (
            <Button
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => setIsCreateOpen(true)}
            >
              Create First Project
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredProjects.map((project) => (
            <div
              key={project._id}
              className={styles.projectCard}
              onClick={() => handleOpenProject(project._id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenProject(project._id)}
            >
              <div className={styles.cardTop}>
                <h3 className={styles.cardTitle}>{project.name}</h3>
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    trigger={
                      <IconButton
                        icon={<MoreVertical size={15} />}
                        label="Project options"
                        size="sm"
                        variant="ghost"
                        className={styles.cardMenuBtn}
                      />
                    }
                    items={[
                      {
                        label: 'Project settings',
                        icon: <Edit2 size={13} />,
                        onClick: () => setProjectToEdit(project),
                      },
                      {
                        label: 'Delete project',
                        icon: <Trash2 size={13} />,
                        danger: true,
                        onClick: (e) => handleDelete(project._id, e),
                      },
                    ]}
                    align="right"
                    portal
                  />
                </div>
              </div>

              <p className={styles.cardDesc}>
                {project.description ||
                  project.customInstructions ||
                  'No description added for this project workspace.'}
              </p>

              <div className={styles.cardBottom}>
                <span>
                  {new Date(project.updatedAt || project.createdAt || Date.now()).toLocaleDateString(
                    undefined,
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    },
                  )}
                </span>

                <div className={styles.badges}>
                  {project.sourceCount > 0 && (
                    <span className={styles.badge} title="Knowledge sources attached">
                      <FileText size={11} /> {project.sourceCount}
                    </span>
                  )}
                  <span className={styles.badge} title="Chats in project">
                    <MessageSquare size={11} /> {project.chatCount || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(created) => {
          if (created?._id) {
            navigate(`${ROUTES.PROJECTS}/${created._id}`);
          }
        }}
      />

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        open={Boolean(projectToEdit)}
        onClose={() => setProjectToEdit(null)}
        project={projectToEdit}
        onSuccess={() => {
          fetchProjects();
        }}
        onOpenDeleteConfirm={() => {
          if (projectToEdit?._id) {
            deleteProject(projectToEdit._id);
            setProjectToEdit(null);
          }
        }}
      />
    </div>
  );
}
