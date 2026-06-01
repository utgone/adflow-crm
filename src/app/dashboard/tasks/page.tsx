"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type TaskStatus =
  | "нова"
  | "в роботі"
  | "готово для перевірки"
  | "на доопрацюванні"
  | "передано клієнту"
  | "на паузі"
  | "виконано"
  | "скасовано";

type Tone = "info" | "amber" | "brand" | "green" | "red";
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";

type Task = {
  task_id: number;

  project_id: number;
  project_name: string;
  project_status: string;

  client_id?: number;
  client_name?: string;
  client_company?: string;

  employee_id: number;
  employee_name: string;
  employee_position: string;
  employee_status?: string;

  service_id: number;
  service_name: string;

  description: string;
  deadline: string;
  task_status: string;
  manager_comment: string;
  date: string;

  is_final?: boolean;
  is_overdue?: boolean;
  can_edit?: boolean;
  can_cancel?: boolean;
  can_change_executor?: boolean;
};

type Project = {
  project_id: number;
  brief_id: number;
  project_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  client_id: number;
  client_name: string;
  client_company: string;
  category: string;
};

type Employee = {
  employee_id: number;
  full_name: string;
  position_id: number;
  position_name: string;
  login: string;
  contacts: string;
  birth_date: string;
  status: string;
};

type Service = {
  service_id: number;
  service_name: string;
};

type TaskForm = {
  project_id: string;
  employee_id: string;
  service_id: string;
  description: string;
  deadline: string;
  task_status: TaskStatus;
  manager_comment: string;
};

type ApiTasksResponse = {
  ok: boolean;
  data?: Task[];
  message?: string;
};

type ApiTaskResponse = {
  ok: boolean;
  data?: Task | null;
  message?: string;
};

type ApiProjectsResponse = {
  ok: boolean;
  data?: Project[];
  message?: string;
};

type ApiEmployeesResponse = {
  ok: boolean;
  data?: Employee[];
  message?: string;
};

type ApiServicesResponse = {
  ok: boolean;
  data?: Service[];
  message?: string;
};

const allowedRoles: Role[] = ["director", "manager", "content", "ads"];

const ownTaskEmployee: Partial<Record<Role, number>> = {
  content: 3,
  ads: 4,
};

const taskStatuses: { id: TaskStatus; label: string; tone: Tone; hint: string }[] = [
  {
    id: "нова",
    label: "Нова",
    tone: "info",
    hint: "Задача створена, але ще не взята в роботу.",
  },
  {
    id: "в роботі",
    label: "В роботі",
    tone: "amber",
    hint: "Виконавець працює над задачею.",
  },
  {
    id: "готово для перевірки",
    label: "Готово для перевірки",
    tone: "brand",
    hint: "Виконавець передав результат менеджеру.",
  },
  {
    id: "на доопрацюванні",
    label: "На доопрацюванні",
    tone: "red",
    hint: "Потрібні правки після перевірки.",
  },
  {
    id: "передано клієнту",
    label: "Передано клієнту",
    tone: "brand",
    hint: "Матеріал передано клієнту на погодження.",
  },
  {
    id: "на паузі",
    label: "На паузі",
    tone: "amber",
    hint: "Роботу тимчасово призупинено.",
  },
  {
    id: "виконано",
    label: "Виконано",
    tone: "green",
    hint: "Задача завершена і залишається в історії.",
  },
  {
    id: "скасовано",
    label: "Скасовано",
    tone: "red",
    hint: "Задачу скасовано без фізичного видалення.",
  },
];

const finalTaskStatuses: TaskStatus[] = ["виконано", "скасовано"];

const finalProjectStatuses = ["завершено", "зупинено", "скасовано"];

const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  нова: ["нова", "в роботі", "скасовано"],
  "в роботі": ["в роботі", "готово для перевірки", "на паузі", "скасовано"],
  "готово для перевірки": [
    "готово для перевірки",
    "передано клієнту",
    "на доопрацюванні",
    "виконано",
    "скасовано",
  ],
  "на доопрацюванні": [
    "на доопрацюванні",
    "в роботі",
    "готово для перевірки",
    "скасовано",
  ],
  "передано клієнту": [
    "передано клієнту",
    "виконано",
    "на доопрацюванні",
    "скасовано",
  ],
  "на паузі": ["на паузі", "в роботі", "скасовано"],
  виконано: ["виконано"],
  скасовано: ["скасовано"],
};

const emptyForm: TaskForm = {
  project_id: "",
  employee_id: "",
  service_id: "",
  description: "",
  deadline: "",
  task_status: "нова",
  manager_comment: "",
};

const toneClass: Record<Tone, string> = {
  info: styles.toneInfo,
  amber: styles.toneAmber,
  brand: styles.toneBrand,
  green: styles.toneGreen,
  red: styles.toneRed,
};

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function maxISODate(...dates: (string | null | undefined)[]) {
  const validDates = dates.filter(Boolean) as string[];

  if (validDates.length === 0) {
    return getTodayISO();
  }

  return validDates.sort()[validDates.length - 1];
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDescriptionInput(value: string) {
  return value.replace(/\s{3,}/g, " ").slice(0, 500);
}

function normalizeCommentInput(value: string) {
  return value.replace(/\s{3,}/g, " ").slice(0, 500);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";

  const normalized = iso.includes("T") ? iso.split("T")[0] : iso;
  const [year, month, day] = normalized.split("-");

  if (!year || !month || !day) {
    return "—";
  }

  return `${day}.${month}.${year}`;
}

function isRealISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);

  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function isTaskStatus(value: string): value is TaskStatus {
  return taskStatuses.some((status) => status.id === value);
}

function isFinalTaskStatus(value: string) {
  return finalTaskStatuses.includes(value as TaskStatus);
}

function isFinalProjectStatus(value: string) {
  return finalProjectStatuses.includes(value);
}

function getStatusMeta(status: string) {
  return (
    taskStatuses.find((item) => item.id === status) || {
      id: "нова",
      label: status || "Невідомо",
      tone: "info" as Tone,
      hint: "Невідомий статус",
    }
  );
}

function getAvailableStatusOptions(task: Task | null) {
  if (!task) {
    return taskStatuses.filter((item) => item.id === "нова");
  }

  const currentStatus = isTaskStatus(task.task_status) ? task.task_status : "нова";
  const allowed = allowedTransitions[currentStatus] || [currentStatus];

  return taskStatuses.filter((item) => allowed.includes(item.id));
}

function getTaskCapabilities(task: Task) {
  const final = Boolean(task.is_final) || isFinalTaskStatus(task.task_status);

  return {
    isFinal: final,
    canEdit: task.can_edit !== undefined ? task.can_edit : !final,
    canCancel: task.can_cancel !== undefined ? task.can_cancel : !final,
    canChangeExecutor:
      task.can_change_executor !== undefined ? task.can_change_executor : !final,
  };
}

function daysUntil(deadline: string) {
  const toUTC = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };

  return Math.round((toUTC(deadline) - toUTC(getTodayISO())) / 86400000);
}

function deadlineTag(task: Task): { label: string; tone: "red" | "amber" } | null {
  if (isFinalTaskStatus(task.task_status)) return null;

  const days = daysUntil(task.deadline);

  if (days < 0) return { label: "Прострочено", tone: "red" };
  if (days <= 3) return { label: "Скоро", tone: "amber" };

  return null;
}

function textIncludesAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();

  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isServiceAllowedForPosition(positionName: string, serviceName: string) {
  const position = positionName.toLowerCase();
  const service = serviceName.toLowerCase();

  const rules = [
    {
      serviceKeywords: ["seo", "сео"],
      allowedPositionKeywords: ["seo", "сео"],
    },
    {
      serviceKeywords: ["контент", "копірайт", "текст", "публікац", "пост"],
      allowedPositionKeywords: ["контент", "smm"],
    },
    {
      serviceKeywords: ["meta ads", "facebook", "instagram", "таргет"],
      allowedPositionKeywords: ["таргет", "ads", "реклам"],
    },
    {
      serviceKeywords: ["google ads", "ppc", "контекст"],
      allowedPositionKeywords: ["google", "ppc", "ads", "реклам"],
    },
    {
      serviceKeywords: ["branding", "бренд", "дизайн", "логотип", "банер"],
      allowedPositionKeywords: ["дизайн", "бренд"],
    },
    {
      serviceKeywords: ["smm", "соцмереж"],
      allowedPositionKeywords: ["smm", "контент", "таргет"],
    },
  ];

  const matchedRule = rules.find((rule) =>
    textIncludesAny(service, rule.serviceKeywords)
  );

  if (!matchedRule) {
    return true;
  }

  return textIncludesAny(position, matchedRule.allowedPositionKeywords);
}

function getSpecializationMessage(positionName: string, serviceName: string) {
  const rules = [
    {
      serviceKeywords: ["seo", "сео"],
      allowedLabel: "SEO / СЕО-спеціаліст",
    },
    {
      serviceKeywords: ["контент", "копірайт", "текст", "публікац", "пост"],
      allowedLabel: "Контент-менеджер / SMM-спеціаліст",
    },
    {
      serviceKeywords: ["meta ads", "facebook", "instagram", "таргет"],
      allowedLabel: "Таргетолог / Ads-спеціаліст",
    },
    {
      serviceKeywords: ["google ads", "ppc", "контекст"],
      allowedLabel: "PPC / Google Ads-спеціаліст",
    },
    {
      serviceKeywords: ["branding", "бренд", "дизайн", "логотип", "банер"],
      allowedLabel: "Дизайнер / бренд-спеціаліст",
    },
    {
      serviceKeywords: ["smm", "соцмереж"],
      allowedLabel: "SMM / Контент / Таргет-спеціаліст",
    },
  ];

  const matchedRule = rules.find((rule) =>
    textIncludesAny(serviceName, rule.serviceKeywords)
  );

  if (!matchedRule) {
    return "";
  }

  return `Послуга «${serviceName}» не відповідає посаді «${positionName}». Потрібен: ${matchedRule.allowedLabel}.`;
}

function validateTaskForm(params: {
  form: TaskForm;
  mode: ModalMode;
  editingTask: Task | null;
  selectedProject: Project | null;
  selectedEmployee: Employee | null;
  selectedService: Service | null;
  canManage: boolean;
}) {
  const {
    form,
    mode,
    editingTask,
    selectedProject,
    selectedEmployee,
    selectedService,
    canManage,
  } = params;

  const projectId = Number(form.project_id);
  const employeeId = Number(form.employee_id);
  const serviceId = Number(form.service_id);
  const description = normalizeSpaces(form.description);
  const managerComment = normalizeSpaces(form.manager_comment);
  const deadline = form.deadline.trim();
  const status = form.task_status;

  if (mode === "create" && (!Number.isInteger(projectId) || projectId <= 0)) {
    return "Оберіть проєкт для задачі.";
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0 || !selectedEmployee) {
    return "Оберіть виконавця задачі.";
  }

  if (selectedEmployee.status === "звільнений") {
    return "Не можна призначити задачу на звільненого співробітника.";
  }

  if (!Number.isInteger(serviceId) || serviceId <= 0 || !selectedService) {
    return "Оберіть послугу для задачі.";
  }

  if (
    !isServiceAllowedForPosition(
      selectedEmployee.position_name,
      selectedService.service_name
    )
  ) {
    return getSpecializationMessage(
      selectedEmployee.position_name,
      selectedService.service_name
    );
  }

  if (description.length < 10) {
    return "Опис задачі має містити мінімум 10 символів.";
  }

  if (description.length > 500) {
    return "Опис задачі не може бути довшим за 500 символів.";
  }

  if (!isRealISODate(deadline)) {
    return "Вкажіть коректний дедлайн задачі.";
  }

  const today = getTodayISO();

  if (deadline < today) {
    return "Дедлайн задачі не може бути раніше сьогоднішньої дати.";
  }

  if (selectedProject && deadline < selectedProject.start_date) {
    return "Дедлайн задачі не може бути раніше дати початку проєкту.";
  }

  if (selectedProject?.end_date && deadline > selectedProject.end_date) {
    return "Дедлайн задачі не може бути пізніше дати завершення проєкту.";
  }

  if (!isTaskStatus(status)) {
    return "Оберіть коректний статус задачі.";
  }

  if (mode === "create" && status !== "нова") {
    return "Нова задача створюється тільки зі статусом «нова».";
  }

  if (mode === "edit" && editingTask && isFinalTaskStatus(editingTask.task_status)) {
    return "Фінальна задача заблокована від редагування.";
  }

  if (mode === "edit" && editingTask && isTaskStatus(editingTask.task_status)) {
    const allowed = allowedTransitions[editingTask.task_status];

    if (!allowed.includes(status)) {
      return `Некоректний перехід статусу: «${editingTask.task_status}» → «${status}».`;
    }
  }

  if (managerComment.length > 0 && managerComment.length < 3) {
    return "Коментар менеджера має містити мінімум 3 символи або бути порожнім.";
  }

  if (!canManage && managerComment !== normalizeSpaces(editingTask?.manager_comment || "")) {
    return "Коментар менеджера може змінювати тільки директор або акаунт-менеджер.";
  }

  return "";
}

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "API повернув не JSON. Перевірте, чи існує route.ts і чи запущено npm run dev."
    );
  }

  return (await response.json()) as T;
}

export default function TasksPage() {
  const { role } = useDashboard();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [executorFilter, setExecutorFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [form, setForm] = useState<TaskForm>({
    ...emptyForm,
    deadline: getTodayISO(),
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [detailsTask, setDetailsTask] = useState<Task | null>(null);

  const [cancelTask, setCancelTask] = useState<Task | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  const canManage = role === "director" || role === "manager";
  const myEmployeeId = ownTaskEmployee[role];

  async function loadTasks() {
    const response = await fetch("/api/tasks", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiTasksResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити задачі.");
    }

    setTasks(result.data);
  }

  async function loadProjects() {
    const response = await fetch("/api/projects", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiProjectsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити проєкти.");
    }

    setProjects(result.data);
  }

  async function loadEmployees() {
    const response = await fetch("/api/employees", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiEmployeesResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити співробітників.");
    }

    setEmployees(result.data);
  }

  async function loadServices() {
    const response = await fetch("/api/services", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiServicesResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити послуги.");
    }

    setServices(result.data);
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([loadTasks(), loadProjects(), loadEmployees(), loadServices()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження задач."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function showPageNotice(type: NoticeType, text: string) {
    setPageNotice({ type, text });

    window.setTimeout(() => {
      setPageNotice(null);
    }, 3800);
  }

  function upsertTask(task: Task) {
    setTasks((current) => {
      const exists = current.some((item) => item.task_id === task.task_id);

      const next = exists
        ? current.map((item) => (item.task_id === task.task_id ? task : item))
        : [...current, task];

      return next.sort((a, b) => a.task_id - b.task_id);
    });
  }

  const visibleTasks = useMemo(() => {
    return canManage
      ? tasks
      : tasks.filter((task) => task.employee_id === myEmployeeId);
  }, [canManage, myEmployeeId, tasks]);

  const availableProjects = useMemo(() => {
    return projects.filter((project) => !isFinalProjectStatus(project.status));
  }, [projects]);

  const activeEmployees = useMemo(() => {
    return employees.filter((employee) => employee.status !== "звільнений");
  }, [employees]);

  const selectedProject = useMemo(() => {
    return projects.find((project) => String(project.project_id) === form.project_id) || null;
  }, [form.project_id, projects]);

  const selectedEmployee = useMemo(() => {
    return (
      employees.find((employee) => String(employee.employee_id) === form.employee_id) ||
      null
    );
  }, [employees, form.employee_id]);

  const selectedService = useMemo(() => {
    return (
      services.find((service) => String(service.service_id) === form.service_id) ||
      null
    );
  }, [form.service_id, services]);

  const availableServicesForEmployee = useMemo(() => {
    if (!selectedEmployee) {
      return [];
    }

    return services.filter((service) =>
      isServiceAllowedForPosition(
        selectedEmployee.position_name,
        service.service_name
      )
    );
  }, [selectedEmployee, services]);

  const serviceCompatibilityWarning = useMemo(() => {
    if (!selectedEmployee || !selectedService) {
      return "";
    }

    if (
      isServiceAllowedForPosition(
        selectedEmployee.position_name,
        selectedService.service_name
      )
    ) {
      return "";
    }

    return getSpecializationMessage(
      selectedEmployee.position_name,
      selectedService.service_name
    );
  }, [selectedEmployee, selectedService]);

  const executors = useMemo(() => {
    const map = new Map<number, string>();

    tasks.forEach((task) => {
      map.set(task.employee_id, task.employee_name);
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = visibleTasks;

    if (statusFilter !== "all") {
      list = list.filter((task) => task.task_status === statusFilter);
    }

    if (canManage && executorFilter !== "all") {
      list = list.filter((task) => String(task.employee_id) === executorFilter);
    }

    if (q) {
      list = list.filter(
        (task) =>
          task.description.toLowerCase().includes(q) ||
          task.project_name.toLowerCase().includes(q) ||
          task.employee_name.toLowerCase().includes(q) ||
          task.service_name.toLowerCase().includes(q) ||
          task.task_status.toLowerCase().includes(q) ||
          (task.client_company || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [canManage, executorFilter, query, statusFilter, visibleTasks]);

  const totals = useMemo(() => {
    const active = visibleTasks.filter((task) => !isFinalTaskStatus(task.task_status)).length;
    const overdue = visibleTasks.filter((task) => task.is_overdue).length;
    const review = visibleTasks.filter(
      (task) => task.task_status === "готово для перевірки"
    ).length;

    return {
      total: visibleTasks.length,
      active,
      overdue,
      review,
    };
  }, [visibleTasks]);

  const selectedDeadlineMin = selectedProject
    ? maxISODate(getTodayISO(), selectedProject.start_date)
    : getTodayISO();

  const modalStatusOptions = getAvailableStatusOptions(editingTask);

  function canEditTask(task: Task) {
    const capabilities = getTaskCapabilities(task);

    if (!capabilities.canEdit) {
      return false;
    }

    return canManage || task.employee_id === myEmployeeId;
  }

  function canCancelTask(task: Task) {
    return canManage && getTaskCapabilities(task).canCancel;
  }

  function handleProjectChange(projectId: string) {
    const project = projects.find((item) => String(item.project_id) === projectId);
    const minDeadline = project ? maxISODate(getTodayISO(), project.start_date) : getTodayISO();

    setForm((current) => ({
      ...current,
      project_id: projectId,
      deadline: current.deadline && current.deadline >= minDeadline ? current.deadline : minDeadline,
    }));

    setFormError("");
    setFormSuccess("");
  }

  function handleEmployeeChange(employeeId: string) {
    const employee = employees.find((item) => String(item.employee_id) === employeeId);
    const currentService = services.find(
      (service) => String(service.service_id) === form.service_id
    );

    const serviceStillAllowed =
      Boolean(employee) &&
      Boolean(currentService) &&
      isServiceAllowedForPosition(
        employee?.position_name || "",
        currentService?.service_name || ""
      );

    setForm((current) => ({
      ...current,
      employee_id: employeeId,
      service_id: serviceStillAllowed ? current.service_id : "",
    }));

    setFormError("");
    setFormSuccess("");
  }

  function openCreateModal() {
    const firstProject = availableProjects[0];

    setModalMode("create");
    setEditingTaskId(null);
    setEditingTask(null);
    setForm({
      ...emptyForm,
      project_id: firstProject ? String(firstProject.project_id) : "",
      deadline: firstProject ? maxISODate(getTodayISO(), firstProject.start_date) : getTodayISO(),
      task_status: "нова",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(task: Task) {
    const safeStatus = isTaskStatus(task.task_status) ? task.task_status : "нова";

    setModalMode("edit");
    setEditingTaskId(task.task_id);
    setEditingTask(task);
    setForm({
      project_id: String(task.project_id),
      employee_id: String(task.employee_id),
      service_id: String(task.service_id),
      description: task.description,
      deadline: task.deadline,
      task_status: safeStatus,
      manager_comment: task.manager_comment || "",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingTaskId(null);
    setEditingTask(null);
    setForm({
      ...emptyForm,
      deadline: getTodayISO(),
    });
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: TaskForm = {
      ...form,
      description: normalizeSpaces(form.description),
      manager_comment: normalizeSpaces(form.manager_comment),
      task_status: modalMode === "create" ? "нова" : form.task_status,
    };

    const validationError = validateTaskForm({
      form: preparedForm,
      mode: modalMode,
      editingTask,
      selectedProject,
      selectedEmployee,
      selectedService,
      canManage,
    });

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingTaskId) {
      setFormError("Не вдалося визначити задачу для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(isEditing ? `/api/tasks/${editingTaskId}` : "/api/tasks", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: Number(preparedForm.project_id),
          employee_id: Number(preparedForm.employee_id),
          service_id: Number(preparedForm.service_id),
          description: preparedForm.description,
          deadline: preparedForm.deadline,
          task_status: preparedForm.task_status,
          manager_comment: preparedForm.manager_comment,
        }),
      });

      const result = await readApiJson<ApiTaskResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(
          result.message ||
            (isEditing ? "Не вдалося оновити задачу." : "Не вдалося створити задачу.")
        );
      }

      upsertTask(result.data);

      if (isEditing) {
        setEditingTask(result.data);
        setFormSuccess("Задачу успішно оновлено в PostgreSQL.");
        showPageNotice("success", "Задачу оновлено.");
      } else {
        const firstProject = availableProjects[0];

        setForm({
          ...emptyForm,
          project_id: firstProject ? String(firstProject.project_id) : "",
          deadline: firstProject
            ? maxISODate(getTodayISO(), firstProject.start_date)
            : getTodayISO(),
        });
        setFormSuccess("Задачу створено. Первинне призначення записано в історію.");
        showPageNotice("success", "Нову задачу створено.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження задачі."
      );
    } finally {
      setSaving(false);
    }
  }

  function requestCancelTask(task: Task) {
    if (!canCancelTask(task)) {
      showPageNotice(
        "error",
        isFinalTaskStatus(task.task_status)
          ? "Фінальну задачу не можна скасувати повторно."
          : "Цю задачу не можна скасувати."
      );
      return;
    }

    setCancelTask(task);
    setCancelError("");
    setCancelSuccess("");
  }

  function closeCancelModal() {
    if (canceling) return;

    setCancelTask(null);
    setCancelError("");
    setCancelSuccess("");
  }

  async function confirmCancelTask() {
    if (!cancelTask) return;

    try {
      setCanceling(true);
      setCancelError("");
      setCancelSuccess("");

      const response = await fetch(`/api/tasks/${cancelTask.task_id}`, {
        method: "DELETE",
      });

      const result = await readApiJson<ApiTaskResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося скасувати задачу.");
      }

      upsertTask(result.data);

      setCancelSuccess(
        "Задачу переведено у статус «скасовано». Історію призначень збережено."
      );

      showPageNotice("success", "Задачу скасовано без фізичного видалення.");

      window.setTimeout(() => {
        setCancelTask(null);
        setCancelSuccess("");
      }, 900);
    } catch (err) {
      setCancelError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час зміни статусу задачі."
      );
    } finally {
      setCanceling(false);
    }
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>Розділ «Задачі» доступний для команди агенції та керівництва.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо задачі з PostgreSQL...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">error</span>
        <p>{error}</p>
      </div>
    );
  }

  const modalTitle = modalMode === "create" ? "Створити задачу" : "Редагувати задачу";

  const modalDescription =
    modalMode === "create"
      ? "Оберіть проєкт, виконавця, відповідну послугу та дедлайн. Нова задача завжди створюється зі статусом «нова»."
      : "Оновіть задачу. Якщо змінити виконавця або послугу, система запише це в історію призначень.";

  const editingCapabilities = editingTask ? getTaskCapabilities(editingTask) : null;
  const coreLockedForWorker = modalMode === "edit" && !canManage;
  const finalLocked = Boolean(editingCapabilities?.isFinal);

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Задачі</h1>
            <p>
              {canManage ? "Усі задачі команди" : "Ваші задачі та дедлайни"} · Усього:{" "}
              {totals.total} · Активних: {totals.active} · Прострочених:{" "}
              {totals.overdue}
            </p>
          </div>

          {canManage && (
            <button className={styles.addButton} type="button" onClick={openCreateModal}>
              <span className="material-symbols-rounded">add</span>
              Нова задача
            </button>
          )}
        </header>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">task_alt</span>
            </span>
            <div>
              <p>Усього</p>
              <strong>{totals.total}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">play_circle</span>
            </span>
            <div>
              <p>Активні</p>
              <strong>{totals.active}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">fact_check</span>
            </span>
            <div>
              <p>На перевірці</p>
              <strong>{totals.review}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">warning</span>
            </span>
            <div>
              <p>Прострочені</p>
              <strong>{totals.overdue}</strong>
            </div>
          </article>
        </section>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span className="material-symbols-rounded">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Пошук за задачею, проєктом, виконавцем або послугою..."
            />
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">flag</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Всі статуси</option>
              {taskStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {canManage && (
            <div className={styles.filterSelect}>
              <span className="material-symbols-rounded">person</span>
              <select
                value={executorFilter}
                onChange={(event) => setExecutorFilter(event.target.value)}
              >
                <option value="all">Всі виконавці</option>
                {executors.map((executor) => (
                  <option key={executor.id} value={String(executor.id)}>
                    {executor.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {pageNotice && (
          <div
            className={cx(
              styles.formMessage,
              pageNotice.type === "error"
                ? styles.formMessageError
                : styles.formMessageSuccess
            )}
          >
            <span className="material-symbols-rounded">
              {pageNotice.type === "error" ? "error" : "check_circle"}
            </span>
            {pageNotice.text}
          </div>
        )}

        {rows.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Задача</th>
                  <th>Проєкт</th>
                  <th>Виконавець</th>
                  <th>Дедлайн</th>
                  <th>Статус</th>
                  <th aria-label="Дії" />
                </tr>
              </thead>

              <tbody>
                {rows.map((task) => {
                  const tag = deadlineTag(task);
                  const meta = getStatusMeta(task.task_status);

                  return (
                    <tr key={task.task_id}>
                      <td>
                        <div className={styles.taskCell}>
                          <span className={styles.taskDesc}>{task.description}</span>

                          <div className={styles.taskSub}>
                            <span className={styles.serviceTag}>
                              {task.service_name}
                            </span>

                            {task.manager_comment && (
                              <span
                                className={styles.commentFlag}
                                title={task.manager_comment}
                              >
                                <span className="material-symbols-rounded">chat</span>
                                Коментар
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={styles.project}>{task.project_name}</span>
                      </td>

                      <td>
                        <div className={styles.person}>
                          <span className={styles.avatar}>
                            {initials(task.employee_name)}
                          </span>

                          <div className={styles.personText}>
                            <span className={styles.personName}>
                              {task.employee_name}
                            </span>
                            <span className={styles.personRole}>
                              {task.employee_position}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className={styles.deadline}>
                          <span className={styles.deadlineDate}>
                            {formatDate(task.deadline)}
                          </span>

                          {tag && (
                            <span
                              className={cx(
                                styles.tag,
                                tag.tone === "red" ? styles.tagRed : styles.tagAmber
                              )}
                            >
                              {tag.label}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className={cx(styles.badge, toneClass[meta.tone])}>
                          {task.task_status}
                        </span>
                      </td>

                      <td className={styles.actionCell}>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.detailBtn}
                            type="button"
                            onClick={() => setDetailsTask(task)}
                          >
                            Деталі
                            <span className="material-symbols-rounded">
                              chevron_right
                            </span>
                          </button>

                          {canEditTask(task) && (
                            <button
                              className={styles.iconBtn}
                              type="button"
                              title="Редагувати"
                              onClick={() => openEditModal(task)}
                            >
                              <span className="material-symbols-rounded">edit</span>
                            </button>
                          )}

                          {canCancelTask(task) && (
                            <button
                              className={styles.iconBtnDanger}
                              type="button"
                              title="Скасувати"
                              onClick={() => requestCancelTask(task)}
                            >
                              <span className="material-symbols-rounded">block</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            <span className="material-symbols-rounded">task_alt</span>
            <p>Задач не знайдено</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий запис PostgreSQL"
                    : "Оновлення запису PostgreSQL"}
                </span>

                <h2 id="task-modal-title">{modalTitle}</h2>
                <p>{modalDescription}</p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveTask} noValidate>
              {modalMode === "create" && availableProjects.length === 0 && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">info</span>
                  Немає активних проєктів для створення задачі. Задачі не можна
                  створювати для завершених, зупинених або скасованих проєктів.
                </div>
              )}

              {finalLocked && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">lock</span>
                  Ця задача фінальна. Редагування заблоковано, щоб не порушити
                  історію CRM.
                </div>
              )}

              {coreLockedForWorker && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">shield_person</span>
                  Виконавець може змінювати тільки статус своєї задачі. Проєкт,
                  виконавець, послуга, опис, дедлайн і коментар менеджера доступні
                  тільки керівництву.
                </div>
              )}

              {serviceCompatibilityWarning && (
                <div className={cx(styles.formMessage, styles.formMessageError)}>
                  <span className="material-symbols-rounded">error</span>
                  {serviceCompatibilityWarning}
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Проєкт</span>
                  <select
                    value={form.project_id}
                    onChange={(event) => handleProjectChange(event.target.value)}
                    disabled={
                      modalMode === "edit" ||
                      finalLocked ||
                      coreLockedForWorker ||
                      !canManage
                    }
                  >
                    <option value="">Оберіть проєкт</option>

                    {modalMode === "create" &&
                      availableProjects.map((project) => (
                        <option value={project.project_id} key={project.project_id}>
                          #{project.project_id} · {project.project_name} ·{" "}
                          {project.client_company || project.client_name}
                        </option>
                      ))}

                    {modalMode === "edit" && editingTask && (
                      <option value={editingTask.project_id}>
                        #{editingTask.project_id} · {editingTask.project_name}
                      </option>
                    )}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Виконавець</span>
                  <select
                    value={form.employee_id}
                    onChange={(event) => handleEmployeeChange(event.target.value)}
                    disabled={finalLocked || coreLockedForWorker || !canManage}
                  >
                    <option value="">Оберіть виконавця</option>

                    {activeEmployees.map((employee) => (
                      <option value={employee.employee_id} key={employee.employee_id}>
                        {employee.full_name} · {employee.position_name}
                      </option>
                    ))}

                    {modalMode === "edit" &&
                      editingTask &&
                      !activeEmployees.some(
                        (employee) => employee.employee_id === editingTask.employee_id
                      ) && (
                        <option value={editingTask.employee_id}>
                          {editingTask.employee_name} · {editingTask.employee_position}
                        </option>
                      )}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Послуга</span>
                  <select
                    value={form.service_id}
                    onChange={(event) => updateForm("service_id", event.target.value)}
                    disabled={
                      finalLocked ||
                      coreLockedForWorker ||
                      !canManage ||
                      !form.employee_id
                    }
                  >
                    <option value="">
                      {form.employee_id
                        ? "Оберіть послугу"
                        : "Спочатку оберіть виконавця"}
                    </option>

                    {availableServicesForEmployee.map((service) => (
                      <option value={service.service_id} key={service.service_id}>
                        {service.service_name}
                      </option>
                    ))}

                    {modalMode === "edit" &&
                      editingTask &&
                      !availableServicesForEmployee.some(
                        (service) => service.service_id === editingTask.service_id
                      ) && (
                        <option value={editingTask.service_id}>
                          {editingTask.service_name} · поточна несумісна послуга
                        </option>
                      )}
                  </select>
                </label>

                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Опис задачі</span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateForm("description", normalizeDescriptionInput(event.target.value))
                    }
                    onBlur={() =>
                      updateForm("description", normalizeSpaces(form.description))
                    }
                    placeholder="Опишіть, що саме потрібно зробити виконавцю..."
                    maxLength={500}
                    disabled={finalLocked || coreLockedForWorker || !canManage}
                  />
                  <small>{form.description.length}/500 символів</small>
                </label>

                <label className={styles.field}>
                  <span>Дедлайн</span>
                  <input
                    value={form.deadline}
                    onChange={(event) => updateForm("deadline", event.target.value)}
                    type="date"
                    min={selectedDeadlineMin}
                    max={selectedProject?.end_date || undefined}
                    disabled={finalLocked || coreLockedForWorker || !canManage}
                  />
                </label>

                <label className={styles.field}>
                  <span>Статус</span>
                  <select
                    value={form.task_status}
                    onChange={(event) =>
                      updateForm("task_status", event.target.value as TaskStatus)
                    }
                    disabled={modalMode === "create" || finalLocked}
                  >
                    {modalStatusOptions.map((status) => (
                      <option value={status.id} key={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Коментар менеджера</span>
                  <textarea
                    value={form.manager_comment}
                    onChange={(event) =>
                      updateForm(
                        "manager_comment",
                        normalizeCommentInput(event.target.value)
                      )
                    }
                    onBlur={() =>
                      updateForm("manager_comment", normalizeSpaces(form.manager_comment))
                    }
                    placeholder="Необовʼязково. Наприклад: що саме виправити або перевірити..."
                    maxLength={500}
                    disabled={finalLocked || !canManage}
                  />
                  <small>{form.manager_comment.length}/500 символів</small>
                </label>
              </div>

              {(formError || formSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    formError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {formError ? "error" : "check_circle"}
                  </span>
                  {formError || formSuccess}
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Скасувати
                </button>

                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={
                    saving ||
                    finalLocked ||
                    Boolean(serviceCompatibilityWarning) ||
                    (modalMode === "create" &&
                      (!canManage || availableProjects.length === 0))
                  }
                >
                  <span className="material-symbols-rounded">
                    {saving ? "sync" : modalMode === "create" ? "add_task" : "save"}
                  </span>
                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Створити задачу"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsTask && (
        <div className={styles.modalOverlay} onMouseDown={() => setDetailsTask(null)}>
          <section
            className={cx(styles.modal, styles.detailsModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>Деталі задачі</span>
                <h2 id="task-details-title">{detailsTask.service_name}</h2>
                <p>
                  {detailsTask.project_name} · {detailsTask.employee_name} ·{" "}
                  {detailsTask.task_status}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setDetailsTask(null)}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className={styles.detailsBody}>
              <div className={styles.detailsGrid}>
                <div>
                  <small>Статус</small>
                  <span
                    className={cx(
                      styles.badge,
                      toneClass[getStatusMeta(detailsTask.task_status).tone]
                    )}
                  >
                    {detailsTask.task_status}
                  </span>
                </div>

                <div>
                  <small>Проєкт</small>
                  <strong>{detailsTask.project_name}</strong>
                </div>

                <div>
                  <small>Виконавець</small>
                  <strong>{detailsTask.employee_name}</strong>
                </div>

                <div>
                  <small>Послуга</small>
                  <strong>{detailsTask.service_name}</strong>
                </div>

                <div>
                  <small>Дата створення</small>
                  <strong>{formatDate(detailsTask.date)}</strong>
                </div>

                <div>
                  <small>Дедлайн</small>
                  <strong>{formatDate(detailsTask.deadline)}</strong>
                </div>
              </div>

              <div className={styles.detailsText}>
                <small>Опис задачі</small>
                <p>{detailsTask.description}</p>
              </div>

              {detailsTask.manager_comment && (
                <div className={styles.detailsText}>
                  <small>Коментар менеджера</small>
                  <p>{detailsTask.manager_comment}</p>
                </div>
              )}

              <div className={styles.modalActions}>
                {canEditTask(detailsTask) && (
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => {
                      setDetailsTask(null);
                      openEditModal(detailsTask);
                    }}
                  >
                    <span className="material-symbols-rounded">edit</span>
                    Редагувати
                  </button>
                )}

                {canCancelTask(detailsTask) && (
                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => {
                      setDetailsTask(null);
                      requestCancelTask(detailsTask);
                    }}
                  >
                    <span className="material-symbols-rounded">block</span>
                    Скасувати задачу
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {cancelTask && (
        <div className={styles.modalOverlay} onMouseDown={closeCancelModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-task-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {cancelSuccess ? "check_circle" : "block"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Зміна статусу в PostgreSQL</span>

              <h2 id="cancel-task-title">Скасувати задачу?</h2>

              <p>
                Задача <strong>«{cancelTask.description}»</strong> буде переведена
                у статус <strong>«скасовано»</strong>.
              </p>

              <p className={styles.confirmNote}>
                Запис не буде видалено фізично з бази. Це потрібно, щоб зберегти
                історію задачі та призначень.
              </p>

              {(cancelError || cancelSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    cancelError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {cancelError ? "error" : "check_circle"}
                  </span>
                  {cancelError || cancelSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeCancelModal}
                disabled={canceling}
              >
                Назад
              </button>

              <button
                className={styles.dangerButton}
                type="button"
                onClick={confirmCancelTask}
                disabled={canceling || Boolean(cancelSuccess)}
              >
                <span className="material-symbols-rounded">
                  {canceling ? "sync" : "block"}
                </span>
                {canceling ? "Оновлення..." : "Так, скасувати"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}