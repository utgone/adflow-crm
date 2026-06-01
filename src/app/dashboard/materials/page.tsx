"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type MaterialStatus =
  | "завантажено"
  | "на перевірці"
  | "погоджено"
  | "відхилено"
  | "на доопрацюванні";

type FileFormat = "zip" | "docx" | "pdf" | "png" | "jpg" | "jpeg" | "txt";
type Tone = "info" | "green" | "red" | "amber";
type ModalMode = "create" | "edit";
type ReviewMode = "approve" | "rework" | "reject";
type NoticeType = "success" | "error";

type Material = {
  material_id: number;

  task_id: number;
  task_description: string;
  task_status: string;

  project_id: number;
  project_name: string;
  project_status: string;

  client_id: number;
  client_name: string;
  client_company: string;
  client_status?: string;

  employee_id: number;
  employee_name: string;
  employee_position: string;

  service_id: number;
  service_name: string;

  date: string;
  file_link: string;
  file_name: string;
  file_format: string;
  upload_date: string;
  material_status: string;
  client_comment: string;

  is_final?: boolean;
  can_edit?: boolean;
  can_review?: boolean;
  can_send_to_review?: boolean;
  can_rework?: boolean;
};

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
  can_edit?: boolean;
};

type MaterialForm = {
  task_id: string;
  file_link: string;
  file_format: string;
  upload_date: string;
};

type ReviewForm = {
  material_status: MaterialStatus;
  client_comment: string;
};

type ApiMaterialsResponse = {
  ok: boolean;
  data?: Material[];
  message?: string;
};

type ApiMaterialResponse = {
  ok: boolean;
  data?: Material | null;
  message?: string;
};

type ApiTasksResponse = {
  ok: boolean;
  data?: Task[];
  message?: string;
};

const allowedRoles: Role[] = ["director", "manager", "content", "ads", "client"];

const CURRENT_CLIENT_ID = 1;

const ownEmployeeByRole: Partial<Record<Role, number>> = {
  content: 3,
  ads: 4,
};

const materialStatuses: {
  id: MaterialStatus;
  label: string;
  tone: Tone;
  hint: string;
}[] = [
  {
    id: "завантажено",
    label: "Завантажено",
    tone: "info",
    hint: "Матеріал додано, але ще не відправлено клієнту на перевірку.",
  },
  {
    id: "на перевірці",
    label: "На перевірці",
    tone: "amber",
    hint: "Матеріал очікує рішення клієнта.",
  },
  {
    id: "погоджено",
    label: "Погоджено",
    tone: "green",
    hint: "Клієнт погодив матеріал. Редагування заблоковано.",
  },
  {
    id: "відхилено",
    label: "Відхилено",
    tone: "red",
    hint: "Матеріал відхилено і залишено в історії CRM.",
  },
  {
    id: "на доопрацюванні",
    label: "На доопрацюванні",
    tone: "red",
    hint: "Клієнт повернув матеріал на правки.",
  },
];

const finalMaterialStatuses: MaterialStatus[] = ["погоджено", "відхилено"];
const finalTaskStatuses = ["виконано", "скасовано"];
const finalProjectStatuses = ["завершено", "зупинено", "скасовано"];

const fileFormats: FileFormat[] = ["zip", "docx", "pdf", "png", "jpg", "jpeg", "txt"];

const emptyForm: MaterialForm = {
  task_id: "",
  file_link: "",
  file_format: "",
  upload_date: "",
};

const emptyReviewForm: ReviewForm = {
  material_status: "погоджено",
  client_comment: "",
};

const statusTone: Record<string, Tone> = {
  завантажено: "info",
  "на перевірці": "amber",
  погоджено: "green",
  відхилено: "red",
  "на доопрацюванні": "red",
};

const toneClass: Record<Tone, string> = {
  info: styles.toneInfo,
  green: styles.toneGreen,
  red: styles.toneRed,
  amber: styles.toneAmber,
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

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUrlInput(value: string) {
  return value.trim().replace(/\s/g, "").slice(0, 300);
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

function isFinalMaterialStatus(value: string) {
  return finalMaterialStatuses.includes(value as MaterialStatus);
}

function isFinalTaskStatus(value: string) {
  return finalTaskStatuses.includes(value);
}

function isFinalProjectStatus(value: string) {
  return finalProjectStatuses.includes(value);
}

function isFileFormat(value: string): value is FileFormat {
  return fileFormats.includes(value.toLowerCase() as FileFormat);
}

function isMaterialStatus(value: string): value is MaterialStatus {
  return materialStatuses.some((status) => status.id === value);
}

function fileName(link: string) {
  try {
    const url = new URL(link);
    return url.pathname.split("/").filter(Boolean).pop() || link;
  } catch {
    return link.split("/").pop() || link;
  }
}

function extractFormatFromLink(link: string) {
  const clean = link.split("?")[0].split("#")[0];
  return clean.split(".").pop()?.toLowerCase() || "";
}

function fileMeta(format: string): { icon: string; cls: string } {
  const f = format.toLowerCase();

  if (["png", "jpg", "jpeg"].includes(f)) {
    return { icon: "image", cls: styles.thumbImage };
  }

  if (f === "pdf") {
    return { icon: "picture_as_pdf", cls: styles.thumbPdf };
  }

  if (["docx", "txt"].includes(f)) {
    return { icon: "description", cls: styles.thumbDoc };
  }

  if (f === "zip") {
    return { icon: "folder_zip", cls: styles.thumbArchive };
  }

  return { icon: "draft", cls: styles.thumbDefault };
}

function getStatusMeta(status: string) {
  return (
    materialStatuses.find((item) => item.id === status) || {
      id: "завантажено",
      label: status || "Невідомо",
      tone: "info" as Tone,
      hint: "Невідомий статус",
    }
  );
}

function getMaterialCapabilities(material: Material) {
  const final = Boolean(material.is_final) || isFinalMaterialStatus(material.material_status);
  const taskFinal = isFinalTaskStatus(material.task_status);
  const projectFinal = isFinalProjectStatus(material.project_status);

  return {
    isFinal: final,
    canEdit:
      material.can_edit !== undefined
        ? material.can_edit
        : !final && !taskFinal && !projectFinal,
    canReview:
      material.can_review !== undefined
        ? material.can_review
        : material.material_status === "на перевірці" && !taskFinal && !projectFinal,
    canSendToReview:
      material.can_send_to_review !== undefined
        ? material.can_send_to_review
        : ["завантажено", "на доопрацюванні"].includes(material.material_status) &&
          !taskFinal &&
          !projectFinal,
    canReject: !final && !taskFinal && !projectFinal,
  };
}

function validateMaterialForm(params: {
  form: MaterialForm;
  mode: ModalMode;
  selectedTask: Task | null;
  editingMaterial: Material | null;
}) {
  const { form, mode, selectedTask, editingMaterial } = params;

  const taskId = Number(form.task_id);
  const fileLink = normalizeSpaces(form.file_link);
  const fileFormat = normalizeSpaces(form.file_format).toLowerCase();
  const uploadDate = form.upload_date.trim();

  if (mode === "create" && (!Number.isInteger(taskId) || taskId <= 0)) {
    return "Оберіть задачу, до якої додається матеріал.";
  }

  if (!/^https?:\/\/\S+$/i.test(fileLink) || fileLink.length > 300) {
    return "Посилання на файл має починатися з http:// або https:// і містити не більше 300 символів.";
  }

  if (!isFileFormat(fileFormat)) {
    return "Формат файлу може бути тільки: zip, docx, pdf, png, jpg, jpeg або txt.";
  }

  const linkFormat = extractFormatFromLink(fileLink);

  if (linkFormat && isFileFormat(linkFormat) && linkFormat !== fileFormat) {
    return "Формат файлу не збігається з розширенням у посиланні.";
  }

  if (!isRealISODate(uploadDate)) {
    return "Вкажіть коректну дату завантаження матеріалу.";
  }

  const materialDate = editingMaterial?.date || getTodayISO();

  if (uploadDate < materialDate) {
    return "Дата завантаження не може бути раніше дати матеріалу.";
  }

  if (selectedTask) {
    if (isFinalTaskStatus(selectedTask.task_status)) {
      return "Не можна додати або змінити матеріал для виконаної чи скасованої задачі.";
    }

    if (isFinalProjectStatus(selectedTask.project_status)) {
      return "Не можна працювати з матеріалом у фінальному проєкті.";
    }

    if (materialDate < selectedTask.date) {
      return "Дата матеріалу не може бути раніше дати створення задачі.";
    }

    if (materialDate > selectedTask.deadline) {
      return "Дата матеріалу не може бути пізніше дедлайну задачі.";
    }
  }

  return "";
}

function validateReviewForm(form: ReviewForm) {
  const status = form.material_status;
  const comment = normalizeSpaces(form.client_comment);

  if (!isMaterialStatus(status)) {
    return "Оберіть коректний статус матеріалу.";
  }

  if (["на доопрацюванні", "відхилено"].includes(status) && comment.length < 3) {
    return "Для доопрацювання або відхилення потрібно вказати коментар мінімум 3 символи.";
  }

  if (comment.length > 500) {
    return "Коментар клієнта не може бути довшим за 500 символів.";
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

export default function MaterialsPage() {
  const { role } = useDashboard();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const [form, setForm] = useState<MaterialForm>({
    ...emptyForm,
    upload_date: getTodayISO(),
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [detailsMaterial, setDetailsMaterial] = useState<Material | null>(null);

  const [reviewMaterial, setReviewMaterial] = useState<Material | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("approve");
  const [reviewForm, setReviewForm] = useState<ReviewForm>(emptyReviewForm);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  const [rejectMaterial, setRejectMaterial] = useState<Material | null>(null);
  const [rejectError, setRejectError] = useState("");
  const [rejectSuccess, setRejectSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  const isClient = role === "client";
  const canManage = role === "director" || role === "manager";
  const canUpload = !isClient;
  const myEmployeeId = ownEmployeeByRole[role];

  async function loadMaterials() {
    const response = await fetch("/api/materials", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiMaterialsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити матеріали.");
    }

    setMaterials(result.data);
  }

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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([loadMaterials(), loadTasks()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження матеріалів."
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

  function upsertMaterial(material: Material) {
    setMaterials((current) => {
      const exists = current.some((item) => item.material_id === material.material_id);

      const next = exists
        ? current.map((item) =>
            item.material_id === material.material_id ? material : item
          )
        : [...current, material];

      return next.sort((a, b) => a.material_id - b.material_id);
    });
  }

  const visibleMaterials = useMemo(() => {
    if (isClient) {
      return materials.filter((item) => item.client_id === CURRENT_CLIENT_ID);
    }

    if (!canManage && myEmployeeId) {
      return materials.filter((item) => item.employee_id === myEmployeeId);
    }

    return materials;
  }, [canManage, isClient, materials, myEmployeeId]);

  const availableTasks = useMemo(() => {
    return tasks.filter((task) => {
      const taskIsAvailable =
        !isFinalTaskStatus(task.task_status) &&
        !isFinalProjectStatus(task.project_status);

      if (!taskIsAvailable) {
        return false;
      }

      if (canManage) {
        return true;
      }

      return myEmployeeId ? task.employee_id === myEmployeeId : false;
    });
  }, [canManage, myEmployeeId, tasks]);

  const selectedTask = useMemo(() => {
    return tasks.find((task) => String(task.task_id) === form.task_id) || null;
  }, [form.task_id, tasks]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = visibleMaterials;

    if (statusFilter !== "all") {
      list = list.filter((item) => item.material_status === statusFilter);
    }

    if (q) {
      list = list.filter(
        (item) =>
          item.file_name.toLowerCase().includes(q) ||
          fileName(item.file_link).toLowerCase().includes(q) ||
          item.project_name.toLowerCase().includes(q) ||
          item.task_description.toLowerCase().includes(q) ||
          item.service_name.toLowerCase().includes(q) ||
          item.employee_name.toLowerCase().includes(q) ||
          item.client_company.toLowerCase().includes(q)
      );
    }

    return list;
  }, [query, statusFilter, visibleMaterials]);

  const totals = useMemo(() => {
    return {
      total: visibleMaterials.length,
      review: visibleMaterials.filter((item) => item.material_status === "на перевірці")
        .length,
      approved: visibleMaterials.filter((item) => item.material_status === "погоджено")
        .length,
      rework: visibleMaterials.filter(
        (item) => item.material_status === "на доопрацюванні"
      ).length,
    };
  }, [visibleMaterials]);

  function canEditMaterial(material: Material) {
    const capabilities = getMaterialCapabilities(material);

    if (!capabilities.canEdit || isClient) {
      return false;
    }

    return canManage || material.employee_id === myEmployeeId;
  }

  function canSendToReview(material: Material) {
    const capabilities = getMaterialCapabilities(material);

    if (!capabilities.canSendToReview || isClient) {
      return false;
    }

    return canManage || material.employee_id === myEmployeeId;
  }

  function canReviewMaterial(material: Material) {
    return (
      isClient &&
      material.client_id === CURRENT_CLIENT_ID &&
      getMaterialCapabilities(material).canReview
    );
  }

  function canRejectMaterial(material: Material) {
    if (isClient) return false;

    return canManage && getMaterialCapabilities(material).canReject;
  }

  function openCreateModal() {
    const firstTask = availableTasks[0];

    setModalMode("create");
    setEditingMaterialId(null);
    setEditingMaterial(null);
    setForm({
      ...emptyForm,
      task_id: firstTask ? String(firstTask.task_id) : "",
      upload_date: getTodayISO(),
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(material: Material) {
    setModalMode("edit");
    setEditingMaterialId(material.material_id);
    setEditingMaterial(material);
    setForm({
      task_id: String(material.task_id),
      file_link: material.file_link,
      file_format: material.file_format,
      upload_date: material.upload_date,
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingMaterialId(null);
    setEditingMaterial(null);
    setForm({
      ...emptyForm,
      upload_date: getTodayISO(),
    });
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof MaterialForm>(
    key: K,
    value: MaterialForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  function handleFileLinkChange(value: string) {
    const normalized = normalizeUrlInput(value);
    const format = extractFormatFromLink(normalized);

    setForm((current) => ({
      ...current,
      file_link: normalized,
      file_format: isFileFormat(format) ? format : current.file_format,
    }));

    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: MaterialForm = {
      ...form,
      file_link: normalizeSpaces(form.file_link),
      file_format: normalizeSpaces(form.file_format).toLowerCase(),
      upload_date: form.upload_date.trim(),
    };

    const validationError = validateMaterialForm({
      form: preparedForm,
      mode: modalMode,
      selectedTask,
      editingMaterial,
    });

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingMaterialId) {
      setFormError("Не вдалося визначити матеріал для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/materials/${editingMaterialId}` : "/api/materials",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            task_id: Number(preparedForm.task_id),
            file_link: preparedForm.file_link,
            file_format: preparedForm.file_format,
            upload_date: preparedForm.upload_date,
            material_status: "завантажено",
          }),
        }
      );

      const result = await readApiJson<ApiMaterialResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Не вдалося оновити матеріал."
              : "Не вдалося створити матеріал.")
        );
      }

      upsertMaterial(result.data);

      if (isEditing) {
        setEditingMaterial(result.data);
        setFormSuccess("Матеріал успішно оновлено.");
        showPageNotice("success", "Матеріал оновлено.");
      } else {
        const firstTask = availableTasks[0];

        setForm({
          ...emptyForm,
          task_id: firstTask ? String(firstTask.task_id) : "",
          upload_date: getTodayISO(),
        });
        setFormSuccess("Матеріал завантажено зі статусом «завантажено».");
        showPageNotice("success", "Матеріал завантажено.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження матеріалу."
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendToReview(material: Material) {
    try {
      const response = await fetch(`/api/materials/${material.material_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          material_status: "на перевірці",
        }),
      });

      const result = await readApiJson<ApiMaterialResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося відправити матеріал на перевірку.");
      }

      upsertMaterial(result.data);
      showPageNotice("success", "Матеріал відправлено на перевірку клієнту.");
    } catch (err) {
      showPageNotice(
        "error",
        err instanceof Error
          ? err.message
          : "Помилка під час відправлення матеріалу на перевірку."
      );
    }
  }

  function openReviewModal(material: Material, mode: ReviewMode) {
    const nextStatus: MaterialStatus =
      mode === "approve"
        ? "погоджено"
        : mode === "rework"
        ? "на доопрацюванні"
        : "відхилено";

    setReviewMaterial(material);
    setReviewMode(mode);
    setReviewForm({
      material_status: nextStatus,
      client_comment: "",
    });
    setReviewError("");
    setReviewSuccess("");
  }

  function closeReviewModal() {
    if (reviewing) return;

    setReviewMaterial(null);
    setReviewMode("approve");
    setReviewForm(emptyReviewForm);
    setReviewError("");
    setReviewSuccess("");
  }

  async function confirmReview() {
    if (!reviewMaterial) return;

    const validationError = validateReviewForm(reviewForm);

    if (validationError) {
      setReviewError(validationError);
      return;
    }

    try {
      setReviewing(true);
      setReviewError("");
      setReviewSuccess("");

      const response = await fetch(`/api/materials/${reviewMaterial.material_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          material_status: reviewForm.material_status,
          client_comment: normalizeSpaces(reviewForm.client_comment),
        }),
      });

      const result = await readApiJson<ApiMaterialResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося оновити статус матеріалу.");
      }

      upsertMaterial(result.data);

      const message =
        reviewMode === "approve"
          ? "Матеріал погоджено."
          : reviewMode === "rework"
          ? "Матеріал повернуто на доопрацювання."
          : "Матеріал відхилено.";

      setReviewSuccess(message);
      showPageNotice("success", message);

      window.setTimeout(() => {
        closeReviewModal();
      }, 900);
    } catch (err) {
      setReviewError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час оновлення статусу матеріалу."
      );
    } finally {
      setReviewing(false);
    }
  }

  function requestRejectMaterial(material: Material) {
    setRejectMaterial(material);
    setRejectError("");
    setRejectSuccess("");
  }

  function closeRejectModal() {
    if (rejecting) return;

    setRejectMaterial(null);
    setRejectError("");
    setRejectSuccess("");
  }

  async function confirmRejectMaterial() {
    if (!rejectMaterial) return;

    try {
      setRejecting(true);
      setRejectError("");
      setRejectSuccess("");

      const response = await fetch(`/api/materials/${rejectMaterial.material_id}`, {
        method: "DELETE",
      });

      const result = await readApiJson<ApiMaterialResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося відхилити матеріал.");
      }

      upsertMaterial(result.data);

      setRejectSuccess(
        "Матеріал переведено у статус «відхилено» без фізичного видалення."
      );
      showPageNotice("success", "Матеріал відхилено.");

      window.setTimeout(() => {
        closeRejectModal();
      }, 900);
    } catch (err) {
      setRejectError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час зміни статусу матеріалу."
      );
    } finally {
      setRejecting(false);
    }
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>
          Розділ «Матеріали» доступний клієнту, команді контенту/реклами та
          керівництву.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо матеріали з PostgreSQL...</p>
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

  const subtitle = isClient
    ? "Матеріали на погодження"
    : canManage
    ? "Усі матеріали проєктів"
    : "Матеріали ваших задач";

  const modalTitle =
    modalMode === "create" ? "Завантажити матеріал" : "Редагувати матеріал";

  const modalDescription =
    modalMode === "create"
      ? "Оберіть задачу, додайте посилання на файл і формат. Новий матеріал створюється зі статусом «завантажено»."
      : "Оновіть посилання, формат або дату завантаження. Погоджені та відхилені матеріали заблоковані.";

  const reviewTitle =
    reviewMode === "approve"
      ? "Погодити матеріал?"
      : reviewMode === "rework"
      ? "Повернути на доопрацювання?"
      : "Відхилити матеріал?";

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Матеріали</h1>
            <p>
              {subtitle} · Усього: {totals.total} · На перевірці: {totals.review} ·
              Погоджено: {totals.approved}
            </p>
          </div>

          {canUpload && (
            <button className={styles.addButton} type="button" onClick={openCreateModal}>
              <span className="material-symbols-rounded">upload</span>
              Завантажити матеріал
            </button>
          )}
        </header>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">folder_open</span>
            </span>
            <div>
              <p>Усього</p>
              <strong>{totals.total}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">rate_review</span>
            </span>
            <div>
              <p>На перевірці</p>
              <strong>{totals.review}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">check_circle</span>
            </span>
            <div>
              <p>Погоджено</p>
              <strong>{totals.approved}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">build_circle</span>
            </span>
            <div>
              <p>Доопрацювання</p>
              <strong>{totals.rework}</strong>
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
              placeholder="Пошук за файлом, проєктом, задачею, послугою або виконавцем..."
            />
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">filter_list</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Всі статуси</option>
              {materialStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
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
          <div className={styles.grid}>
            {rows.map((item) => {
              const meta = fileMeta(item.file_format);
              const statusMeta = getStatusMeta(item.material_status);

              return (
                <article className={styles.card} key={item.material_id}>
                  <div className={styles.cardHead}>
                    <span className={cx(styles.thumb, meta.cls)}>
                      <span className="material-symbols-rounded">{meta.icon}</span>
                    </span>

                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>
                        {item.file_name || fileName(item.file_link)}
                      </span>
                      <span className={styles.fileFormat}>
                        {item.file_format.toUpperCase()} · {formatDate(item.upload_date)}
                      </span>
                    </div>

                    <span
                      className={cx(
                        styles.badge,
                        toneClass[statusTone[item.material_status] || statusMeta.tone]
                      )}
                    >
                      {item.material_status}
                    </span>
                  </div>

                  <div className={styles.context}>
                    <span className={styles.contextItem}>
                      <span className="material-symbols-rounded">folder_open</span>
                      <span className={styles.contextText}>{item.project_name}</span>
                    </span>

                    <span className={styles.contextItem}>
                      <span className="material-symbols-rounded">task</span>
                      <span className={styles.contextText}>{item.task_description}</span>
                    </span>

                    <span className={styles.contextItem}>
                      <span className="material-symbols-rounded">person</span>
                      <span className={styles.contextText}>
                        {item.employee_name} · {item.service_name}
                      </span>
                    </span>
                  </div>

                  {item.client_comment && (
                    <div className={styles.comment}>
                      <span className="material-symbols-rounded">format_quote</span>
                      <p>{item.client_comment}</p>
                    </div>
                  )}

                  <div className={styles.actions}>
                    {canReviewMaterial(item) ? (
                      <>
                        <button
                          className={cx(styles.btn, styles.btnApprove)}
                          type="button"
                          onClick={() => openReviewModal(item, "approve")}
                        >
                          <span className="material-symbols-rounded">check</span>
                          Погодити
                        </button>

                        <button
                          className={cx(styles.btn, styles.btnReject)}
                          type="button"
                          onClick={() => openReviewModal(item, "rework")}
                        >
                          <span className="material-symbols-rounded">undo</span>
                          На доопрацювання
                        </button>
                      </>
                    ) : (
                      <button
                        className={cx(styles.btn, styles.btnOpen)}
                        type="button"
                        onClick={() => window.open(item.file_link, "_blank", "noopener")}
                      >
                        <span className="material-symbols-rounded">open_in_new</span>
                        Відкрити файл
                      </button>
                    )}
                  </div>

                  {!isClient && (
                    <div className={styles.secondaryActions}>
                      {canSendToReview(item) && (
                        <button
                          className={styles.smallAction}
                          type="button"
                          onClick={() => sendToReview(item)}
                        >
                          <span className="material-symbols-rounded">send</span>
                          На перевірку
                        </button>
                      )}

                      {canEditMaterial(item) && (
                        <button
                          className={styles.smallAction}
                          type="button"
                          onClick={() => openEditModal(item)}
                        >
                          <span className="material-symbols-rounded">edit</span>
                          Редагувати
                        </button>
                      )}

                      {canRejectMaterial(item) && (
                        <button
                          className={styles.smallActionDanger}
                          type="button"
                          onClick={() => requestRejectMaterial(item)}
                        >
                          <span className="material-symbols-rounded">block</span>
                          Відхилити
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    className={styles.detailsButton}
                    type="button"
                    onClick={() => setDetailsMaterial(item)}
                  >
                    Деталі
                    <span className="material-symbols-rounded">chevron_right</span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <span className="material-symbols-rounded">folder_off</span>
            <p>Матеріалів не знайдено</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="material-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий запис PostgreSQL"
                    : "Оновлення запису PostgreSQL"}
                </span>

                <h2 id="material-modal-title">{modalTitle}</h2>
                <p>{modalDescription}</p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveMaterial} noValidate>
              {modalMode === "create" && availableTasks.length === 0 && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">info</span>
                  Немає активних задач для завантаження матеріалів. Матеріали не можна
                  додавати до виконаних або скасованих задач.
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Задача</span>
                  <select
                    value={form.task_id}
                    onChange={(event) => updateForm("task_id", event.target.value)}
                    disabled={modalMode === "edit"}
                  >
                    <option value="">Оберіть задачу</option>

                    {modalMode === "create" &&
                      availableTasks.map((task) => (
                        <option value={task.task_id} key={task.task_id}>
                          #{task.task_id} · {task.project_name} · {task.service_name} ·{" "}
                          {task.employee_name}
                        </option>
                      ))}

                    {modalMode === "edit" && editingMaterial && (
                      <option value={editingMaterial.task_id}>
                        #{editingMaterial.task_id} · {editingMaterial.project_name} ·{" "}
                        {editingMaterial.service_name}
                      </option>
                    )}
                  </select>
                </label>

                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Посилання на файл</span>
                  <input
                    value={form.file_link}
                    onChange={(event) => handleFileLinkChange(event.target.value)}
                    type="url"
                    placeholder="https://example.com/files/material.pdf"
                    maxLength={300}
                  />
                </label>

                <label className={styles.field}>
                  <span>Формат файлу</span>
                  <select
                    value={form.file_format}
                    onChange={(event) => updateForm("file_format", event.target.value)}
                  >
                    <option value="">Оберіть формат</option>
                    {fileFormats.map((format) => (
                      <option value={format} key={format}>
                        {format.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Дата завантаження</span>
                  <input
                    value={form.upload_date}
                    onChange={(event) => updateForm("upload_date", event.target.value)}
                    type="date"
                    min={editingMaterial?.date || getTodayISO()}
                    max={selectedTask?.deadline || undefined}
                  />
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
                  disabled={saving || (modalMode === "create" && availableTasks.length === 0)}
                >
                  <span className="material-symbols-rounded">
                    {saving ? "sync" : modalMode === "create" ? "upload" : "save"}
                  </span>
                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Завантажити"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsMaterial && (
        <div
          className={styles.modalOverlay}
          onMouseDown={() => setDetailsMaterial(null)}
        >
          <section
            className={cx(styles.modal, styles.detailsModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="material-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>Деталі матеріалу</span>
                <h2 id="material-details-title">
                  {detailsMaterial.file_name || fileName(detailsMaterial.file_link)}
                </h2>
                <p>
                  {detailsMaterial.project_name} · {detailsMaterial.service_name} ·{" "}
                  {detailsMaterial.material_status}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setDetailsMaterial(null)}
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
                      toneClass[statusTone[detailsMaterial.material_status] || "info"]
                    )}
                  >
                    {detailsMaterial.material_status}
                  </span>
                </div>

                <div>
                  <small>Формат</small>
                  <strong>{detailsMaterial.file_format.toUpperCase()}</strong>
                </div>

                <div>
                  <small>Дата завантаження</small>
                  <strong>{formatDate(detailsMaterial.upload_date)}</strong>
                </div>

                <div>
                  <small>Проєкт</small>
                  <strong>{detailsMaterial.project_name}</strong>
                </div>

                <div>
                  <small>Задача</small>
                  <strong>#{detailsMaterial.task_id}</strong>
                </div>

                <div>
                  <small>Виконавець</small>
                  <strong>{detailsMaterial.employee_name}</strong>
                </div>
              </div>

              <div className={styles.detailsText}>
                <small>Опис задачі</small>
                <p>{detailsMaterial.task_description}</p>
              </div>

              {detailsMaterial.client_comment && (
                <div className={styles.detailsText}>
                  <small>Коментар клієнта</small>
                  <p>{detailsMaterial.client_comment}</p>
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() =>
                    window.open(detailsMaterial.file_link, "_blank", "noopener")
                  }
                >
                  <span className="material-symbols-rounded">open_in_new</span>
                  Відкрити файл
                </button>

                {canEditMaterial(detailsMaterial) && (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => {
                      setDetailsMaterial(null);
                      openEditModal(detailsMaterial);
                    }}
                  >
                    <span className="material-symbols-rounded">edit</span>
                    Редагувати
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {reviewMaterial && (
        <div className={styles.modalOverlay} onMouseDown={closeReviewModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-material-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {reviewMode === "approve" ? "check_circle" : "rate_review"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Рішення клієнта</span>
              <h2 id="review-material-title">{reviewTitle}</h2>

              <p>
                Матеріал <strong>{reviewMaterial.file_name}</strong> змінить статус на{" "}
                <strong>«{reviewForm.material_status}»</strong>.
              </p>

              <label className={cx(styles.field, styles.reviewComment)}>
                <span>
                  Коментар{" "}
                  {reviewMode === "approve"
                    ? "(необовʼязково)"
                    : "(обовʼязково)"}
                </span>
                <textarea
                  value={reviewForm.client_comment}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      client_comment: normalizeCommentInput(event.target.value),
                    }))
                  }
                  onBlur={() =>
                    setReviewForm((current) => ({
                      ...current,
                      client_comment: normalizeSpaces(current.client_comment),
                    }))
                  }
                  placeholder={
                    reviewMode === "approve"
                      ? "Можете залишити короткий коментар..."
                      : "Опишіть, що саме потрібно виправити..."
                  }
                  maxLength={500}
                />
                <small>{reviewForm.client_comment.length}/500 символів</small>
              </label>

              {(reviewError || reviewSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    reviewError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {reviewError ? "error" : "check_circle"}
                  </span>
                  {reviewError || reviewSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeReviewModal}
                disabled={reviewing}
              >
                Скасувати
              </button>

              <button
                className={
                  reviewMode === "approve" ? styles.primaryButton : styles.dangerButton
                }
                type="button"
                onClick={confirmReview}
                disabled={reviewing || Boolean(reviewSuccess)}
              >
                <span className="material-symbols-rounded">
                  {reviewing
                    ? "sync"
                    : reviewMode === "approve"
                    ? "check"
                    : "undo"}
                </span>
                {reviewing
                  ? "Оновлення..."
                  : reviewMode === "approve"
                  ? "Погодити"
                  : "Повернути"}
              </button>
            </div>
          </section>
        </div>
      )}

      {rejectMaterial && (
        <div className={styles.modalOverlay} onMouseDown={closeRejectModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-material-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {rejectSuccess ? "check_circle" : "block"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Зміна статусу в PostgreSQL</span>
              <h2 id="reject-material-title">Відхилити матеріал?</h2>

              <p>
                Матеріал <strong>{rejectMaterial.file_name}</strong> буде переведений
                у статус <strong>«відхилено»</strong>.
              </p>

              <p className={styles.confirmNote}>
                Запис не буде видалено фізично з бази. Це потрібно для збереження
                історії задачі та погоджень.
              </p>

              {(rejectError || rejectSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    rejectError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {rejectError ? "error" : "check_circle"}
                  </span>
                  {rejectError || rejectSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeRejectModal}
                disabled={rejecting}
              >
                Скасувати
              </button>

              <button
                className={styles.dangerButton}
                type="button"
                onClick={confirmRejectMaterial}
                disabled={rejecting || Boolean(rejectSuccess)}
              >
                <span className="material-symbols-rounded">
                  {rejecting ? "sync" : "block"}
                </span>
                {rejecting ? "Оновлення..." : "Так, відхилити"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}