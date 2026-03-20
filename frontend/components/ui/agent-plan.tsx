// [claude-code 2026-03-11] 21st.dev AgentPlan replacement — full featured with framer-motion animations, subtasks, tool badges, Pulse theme
"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup, type Variants } from "framer-motion";

interface Subtask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tools?: string[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  level: number;
  dependencies: string[];
  subtasks: Subtask[];
}

const initialTasks: Task[] = [
  {
    id: "1",
    title: "Research Project Requirements",
    description:
      "Gather all necessary information about project scope and requirements",
    status: "in-progress",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "1.1",
        title: "Interview stakeholders",
        description:
          "Conduct interviews with key stakeholders to understand needs",
        status: "completed",
        priority: "high",
        tools: ["communication-agent", "meeting-scheduler"],
      },
      {
        id: "1.2",
        title: "Review existing documentation",
        description:
          "Go through all available documentation and extract requirements",
        status: "in-progress",
        priority: "medium",
        tools: ["file-system", "browser"],
      },
      {
        id: "1.3",
        title: "Compile findings report",
        description:
          "Create a comprehensive report of all gathered information",
        status: "need-help",
        priority: "medium",
        tools: ["file-system", "markdown-processor"],
      },
    ],
  },
  {
    id: "2",
    title: "Design System Architecture",
    description:
      "Create the overall system architecture based on requirements",
    status: "in-progress",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "2.1",
        title: "Define component structure",
        description:
          "Map out all required components and their interactions",
        status: "pending",
        priority: "high",
        tools: ["architecture-planner", "diagramming-tool"],
      },
      {
        id: "2.2",
        title: "Create data flow diagrams",
        description:
          "Design diagrams showing how data will flow through the system",
        status: "pending",
        priority: "medium",
        tools: ["diagramming-tool", "file-system"],
      },
      {
        id: "2.3",
        title: "Document API specifications",
        description:
          "Write detailed specifications for all APIs in the system",
        status: "pending",
        priority: "high",
        tools: ["api-designer", "openapi-generator"],
      },
    ],
  },
  {
    id: "3",
    title: "Implementation Planning",
    description: "Create a detailed plan for implementing the system",
    status: "pending",
    priority: "medium",
    level: 1,
    dependencies: ["1", "2"],
    subtasks: [
      {
        id: "3.1",
        title: "Resource allocation",
        description:
          "Determine required resources and allocate them to tasks",
        status: "pending",
        priority: "medium",
        tools: ["project-manager", "resource-calculator"],
      },
      {
        id: "3.2",
        title: "Timeline development",
        description: "Create a timeline with milestones and deadlines",
        status: "pending",
        priority: "high",
        tools: ["timeline-generator", "gantt-chart-creator"],
      },
      {
        id: "3.3",
        title: "Risk assessment",
        description:
          "Identify potential risks and develop mitigation strategies",
        status: "pending",
        priority: "medium",
        tools: ["risk-analyzer"],
      },
    ],
  },
  {
    id: "4",
    title: "Development Environment Setup",
    description:
      "Set up all necessary tools and environments for development",
    status: "in-progress",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "4.1",
        title: "Install development tools",
        description:
          "Set up IDEs, version control, and other necessary development tools",
        status: "pending",
        priority: "high",
        tools: ["shell", "package-manager"],
      },
      {
        id: "4.2",
        title: "Configure CI/CD pipeline",
        description:
          "Set up continuous integration and deployment pipelines",
        status: "pending",
        priority: "medium",
        tools: ["github-actions", "gitlab-ci", "jenkins-connector"],
      },
      {
        id: "4.3",
        title: "Set up testing framework",
        description:
          "Configure automated testing frameworks for the project",
        status: "pending",
        priority: "high",
        tools: ["test-runner", "shell"],
      },
    ],
  },
  {
    id: "5",
    title: "Initial Development Sprint",
    description: "Execute the first development sprint based on the plan",
    status: "pending",
    priority: "medium",
    level: 1,
    dependencies: ["4"],
    subtasks: [
      {
        id: "5.1",
        title: "Implement core features",
        description:
          "Develop the essential features identified in the requirements",
        status: "pending",
        priority: "high",
        tools: ["code-assistant", "github", "file-system", "shell"],
      },
      {
        id: "5.2",
        title: "Perform unit testing",
        description:
          "Create and execute unit tests for implemented features",
        status: "pending",
        priority: "medium",
        tools: ["test-runner", "code-coverage-analyzer"],
      },
      {
        id: "5.3",
        title: "Document code",
        description: "Create documentation for the implemented code",
        status: "pending",
        priority: "low",
        tools: ["documentation-generator", "markdown-processor"],
      },
    ],
  },
];

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-[var(--fintheon-bullish)]" />;
    case "in-progress":
      return <CircleDotDashed className="w-4 h-4 text-blue-400" />;
    case "pending":
      return <Circle className="w-4 h-4 text-zinc-500" />;
    case "need-help":
      return <CircleAlert className="w-4 h-4 text-yellow-400" />;
    case "failed":
      return <CircleX className="w-4 h-4 text-[var(--fintheon-bearish)]" />;
    default:
      return <Circle className="w-4 h-4 text-zinc-500" />;
  }
}

function getStatusBadge(status: string) {
  const base = "text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize";
  switch (status) {
    case "completed":
      return (
        <span
          className={`${base} bg-[var(--fintheon-bullish)]/15 text-[var(--fintheon-bullish)]`}
        >
          {status}
        </span>
      );
    case "in-progress":
      return (
        <span className={`${base} bg-blue-500/15 text-blue-400`}>
          {status}
        </span>
      );
    case "pending":
      return (
        <span className={`${base} bg-zinc-800 text-zinc-500`}>{status}</span>
      );
    case "need-help":
      return (
        <span className={`${base} bg-yellow-500/15 text-yellow-400`}>
          {status}
        </span>
      );
    case "failed":
      return (
        <span
          className={`${base} bg-[var(--fintheon-bearish)]/15 text-[var(--fintheon-bearish)]`}
        >
          {status}
        </span>
      );
    default:
      return (
        <span className={`${base} bg-zinc-800 text-zinc-500`}>{status}</span>
      );
  }
}

function getPriorityBadge(priority: string) {
  const base = "text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize";
  switch (priority) {
    case "high":
      return (
        <span
          className={`${base} bg-[var(--fintheon-bearish)]/15 text-[var(--fintheon-bearish)]`}
        >
          {priority}
        </span>
      );
    case "medium":
      return (
        <span className={`${base} bg-yellow-500/15 text-yellow-400`}>
          {priority}
        </span>
      );
    case "low":
      return (
        <span className={`${base} bg-blue-500/15 text-blue-400`}>
          {priority}
        </span>
      );
    default:
      return (
        <span className={`${base} bg-zinc-800 text-zinc-500`}>{priority}</span>
      );
  }
}

export default function Plan() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [expandedTasks, setExpandedTasks] = useState<string[]>(["1"]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<{
    [key: string]: boolean;
  }>({});
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          const statuses = [
            "completed",
            "in-progress",
            "pending",
            "need-help",
            "failed",
          ];
          const currentIndex = Math.floor(Math.random() * statuses.length);
          const newStatus = statuses[currentIndex];
          const updatedSubtasks = task.subtasks.map((subtask) => ({
            ...subtask,
            status:
              newStatus === "completed" ? "completed" : subtask.status,
          }));
          return { ...task, status: newStatus, subtasks: updatedSubtasks };
        }
        return task;
      })
    );
  };

  const toggleSubtaskStatus = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          const updatedSubtasks = task.subtasks.map((subtask) => {
            if (subtask.id === subtaskId) {
              return {
                ...subtask,
                status:
                  subtask.status === "completed" ? "pending" : "completed",
              };
            }
            return subtask;
          });
          const allSubtasksCompleted = updatedSubtasks.every(
            (s) => s.status === "completed"
          );
          return {
            ...task,
            subtasks: updatedSubtasks,
            status: allSubtasksCompleted ? "completed" : task.status,
          };
        }
        return task;
      })
    );
  };

  const taskVariants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: prefersReducedMotion ? "tween" : "spring",
        stiffness: 500,
        damping: 30,
        duration: prefersReducedMotion ? 0.2 : undefined,
      },
    },
    exit: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -5,
      transition: { duration: 0.15 },
    },
  };

  const subtaskListVariants: Variants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: {
      height: "auto" as const,
      opacity: 1,
      overflow: "visible" as const,
      transition: {
        duration: 0.25,
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        when: "beforeChildren" as const,
        ease: [0.2, 0.65, 0.3, 0.9],
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      overflow: "hidden" as const,
      transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] },
    },
  };

  const subtaskVariants: Variants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: prefersReducedMotion ? "tween" : "spring",
        stiffness: 500,
        damping: 25,
        duration: prefersReducedMotion ? 0.2 : undefined,
      },
    },
    exit: {
      opacity: 0,
      x: prefersReducedMotion ? 0 : -10,
      transition: { duration: 0.15 },
    },
  };

  const subtaskDetailsVariants: Variants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" as const },
    visible: {
      opacity: 1,
      height: "auto" as const,
      overflow: "visible" as const,
      transition: { duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] },
    },
  };

  const statusBadgeVariants: Variants = {
    initial: { scale: 1 },
    animate: {
      scale: prefersReducedMotion ? 1 : [1, 1.08, 1],
      transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] },
    },
  };

  const completedCount = tasks.filter(
    (t) => t.status === "completed"
  ).length;
  const totalCount = tasks.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-[var(--fintheon-bg)] text-[var(--fintheon-text)] h-full overflow-auto p-2">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-[var(--fintheon-text)]">
              Agent Plan
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">
                {completedCount}/{totalCount} tasks
              </span>
              <span className="text-xs font-medium text-[var(--fintheon-accent)]">
                {progressPercent}%
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--fintheon-accent)] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Task List */}
        <LayoutGroup>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {tasks.map((task) => {
                const isExpanded = expandedTasks.includes(task.id);
                const taskCompletedSubtasks = task.subtasks.filter(
                  (s) => s.status === "completed"
                ).length;
                const taskTotalSubtasks = task.subtasks.length;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    variants={taskVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] overflow-hidden"
                  >
                    {/* Task header */}
                    <motion.div
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
                      onClick={() => toggleTaskExpansion(task.id)}
                      whileHover={{
                        backgroundColor: "rgba(199, 159, 74, 0.05)",
                      }}
                      transition={{ duration: 0.15 }}
                    >
                      {/* Expand/collapse indicator */}
                      <motion.span
                        className="text-zinc-500 text-xs"
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        &#9654;
                      </motion.span>

                      {/* Status icon */}
                      <motion.div
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskStatus(task.id);
                        }}
                        variants={statusBadgeVariants}
                        initial="initial"
                        animate="animate"
                        key={task.status}
                      >
                        {getStatusIcon(task.status)}
                      </motion.div>

                      {/* Task title and info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium truncate ${
                              task.status === "completed"
                                ? "line-through text-zinc-500"
                                : "text-[var(--fintheon-text)]"
                            }`}
                          >
                            {task.title}
                          </span>
                          {task.level > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] font-medium">
                              L{task.level}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {getStatusBadge(task.status)}
                        {getPriorityBadge(task.priority)}
                        <span className="text-[10px] text-zinc-500 ml-1">
                          {taskCompletedSubtasks}/{taskTotalSubtasks}
                        </span>
                      </div>
                    </motion.div>

                    {/* Dependencies */}
                    {task.dependencies.length > 0 && (
                      <div className="px-3 pb-1.5 flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500">
                          Depends on:
                        </span>
                        {task.dependencies.map((dep) => (
                          <span
                            key={dep}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                          >
                            #{dep}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Subtask list */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          variants={subtaskListVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="border-t border-[var(--fintheon-accent)]/20"
                        >
                          {/* Task description */}
                          <div className="px-3 py-2 bg-[var(--fintheon-accent)]/10">
                            <p className="text-xs text-zinc-500">
                              {task.description}
                            </p>
                          </div>

                          {/* Subtasks */}
                          <div className="divide-y divide-zinc-700/30">
                            {task.subtasks.map((subtask) => {
                              const subtaskKey = `${task.id}-${subtask.id}`;
                              const isSubtaskExpanded =
                                expandedSubtasks[subtaskKey];

                              return (
                                <motion.div
                                  key={subtask.id}
                                  variants={subtaskVariants}
                                  className="group"
                                >
                                  <motion.div
                                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none"
                                    onClick={() =>
                                      toggleSubtaskExpansion(
                                        task.id,
                                        subtask.id
                                      )
                                    }
                                    whileHover={{
                                      backgroundColor:
                                        "rgba(199, 159, 74, 0.05)",
                                    }}
                                    transition={{ duration: 0.15 }}
                                  >
                                    {/* Subtask expand indicator */}
                                    <motion.span
                                      className="text-zinc-500 text-[10px] ml-3"
                                      animate={{
                                        rotate: isSubtaskExpanded ? 90 : 0,
                                      }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      &#9654;
                                    </motion.span>

                                    {/* Subtask status icon */}
                                    <motion.div
                                      className="cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSubtaskStatus(
                                          task.id,
                                          subtask.id
                                        );
                                      }}
                                      variants={statusBadgeVariants}
                                      initial="initial"
                                      animate="animate"
                                      key={subtask.status}
                                    >
                                      {getStatusIcon(subtask.status)}
                                    </motion.div>

                                    {/* Subtask title */}
                                    <span
                                      className={`text-xs flex-1 truncate ${
                                        subtask.status === "completed"
                                          ? "line-through text-zinc-500"
                                          : "text-[var(--fintheon-text)]"
                                      }`}
                                    >
                                      {subtask.title}
                                    </span>

                                    {/* Subtask badges */}
                                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {getStatusBadge(subtask.status)}
                                      {getPriorityBadge(subtask.priority)}
                                    </div>
                                  </motion.div>

                                  {/* Subtask details */}
                                  <AnimatePresence>
                                    {isSubtaskExpanded && (
                                      <motion.div
                                        variants={subtaskDetailsVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="hidden"
                                        className="px-3 pb-2 ml-10"
                                      >
                                        <p className="text-[11px] text-zinc-500 mb-1.5">
                                          {subtask.description}
                                        </p>
                                        {subtask.tools &&
                                          subtask.tools.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {subtask.tools.map((tool) => (
                                                <motion.span
                                                  key={tool}
                                                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/20"
                                                  whileHover={{
                                                    backgroundColor:
                                                      "rgba(199, 159, 74, 0.15)",
                                                  }}
                                                >
                                                  {tool}
                                                </motion.span>
                                              ))}
                                            </div>
                                          )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
}

// Backwards compatibility exports
export { Plan as AgentPlan };
export type { Task as PlanTask };
