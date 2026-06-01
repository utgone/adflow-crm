import Link from "next/link";
import LandingAnimations from "@/components/landing/LandingAnimations";
import { getCurrentUser } from "@/lib/auth";
import CookieBanner from "./CookieBanner";
import LandingUserActions from "./LandingUserActions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const heroStats = [
  {
    value: "13",
    label: "сутностей БД",
    icon: "database",
  },
  {
    value: "10+",
    label: "CRM-модулів",
    icon: "dashboard_customize",
  },
  {
    value: "100%",
    label: "PostgreSQL",
    icon: "storage",
  },
];

const features = [
  {
    icon: "groups",
    title: "Клієнтська база",
    text: "Ведіть облік клієнтів, компаній, контактів, статусів співпраці та історії взаємодії.",
  },
  {
    icon: "assignment",
    title: "Брифи та проєкти",
    text: "Створюйте брифи, запускайте проєкти та контролюйте дедлайни рекламних задач.",
  },
  {
    icon: "campaign",
    title: "Рекламні кампанії",
    text: "Керуйте каналами просування, бюджетами, датами запуску та статусами кампаній.",
  },
  {
    icon: "analytics",
    title: "Аналітика та оплати",
    text: "Відстежуйте статистику, рахунки, оплати, витрати та ефективність роботи агенції.",
  },
];

const modules = [
  { icon: "person", label: "Клієнти", entity: "client" },
  { icon: "article", label: "Брифи", entity: "brief" },
  { icon: "folder_managed", label: "Проєкти", entity: "project" },
  { icon: "campaign", label: "Кампанії", entity: "campaign" },
  { icon: "design_services", label: "Послуги", entity: "service" },
  { icon: "badge", label: "Співробітники", entity: "employee" },
  { icon: "task_alt", label: "Задачі", entity: "task" },
  { icon: "attach_file", label: "Матеріали", entity: "material" },
  { icon: "receipt_long", label: "Рахунки", entity: "invoice" },
  { icon: "payments", label: "Оплати", entity: "payment" },
  { icon: "query_stats", label: "Статистика", entity: "statistic" },
  { icon: "admin_panel_settings", label: "Посади", entity: "position" },
];

const workflow = [
  {
    step: "01",
    icon: "edit_document",
    title: "Клієнт залишає бриф",
    text: "Система зберігає вимоги, категорію послуг, бюджет і статус заявки.",
  },
  {
    step: "02",
    icon: "folder_open",
    title: "Менеджер створює проєкт",
    text: "Бриф перетворюється на проєкт із датами, задачами та відповідальними.",
  },
  {
    step: "03",
    icon: "campaign",
    title: "Запускаються кампанії",
    text: "Для проєкту створюються рекламні кампанії, бюджет і статистика.",
  },
  {
    step: "04",
    icon: "credit_score",
    title: "Фіксуються рахунки й оплати",
    text: "CRM контролює фінансові операції та статуси оплат по проєктах.",
  },
];

const databaseHighlights = [
  "Primary keys",
  "Foreign keys",
  "Check constraints",
  "Unique constraints",
  "PostgreSQL",
  "Prisma ORM",
];

const previewRows = [
  {
    icon: "campaign",
    title: "Google Ads — Nova Media",
    meta: "Активна кампанія",
    value: "₴48K",
  },
  {
    icon: "task_alt",
    title: "Дизайн банерів",
    meta: "Виконання задачі",
    value: "86%",
  },
  {
    icon: "receipt_long",
    title: "Рахунок #A-204",
    meta: "Очікує оплату",
    value: "₴12K",
  },
];

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const isAuthenticated = Boolean(currentUser);

  return (
    <main className={styles.page}>
      <LandingAnimations />

      <div className={styles.backgroundAura} aria-hidden="true" />
      <div className={styles.backgroundGrid} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="AdFlow CRM">
          <span className={styles.logoIcon}>
            <span className="material-symbols-rounded">hub</span>
          </span>

          <span className={styles.logoText}>
            <strong>AdFlow</strong>
            <small>CRM</small>
          </span>
        </Link>

        <nav className={styles.nav}>
          <a href="#features">Можливості</a>
          <a href="#workflow">Процес</a>
          <a href="#modules">Модулі</a>
          <a href="#database">База даних</a>
        </nav>

        <div className={styles.authActions}>
          {currentUser ? (
            <LandingUserActions
              user={{
                name: currentUser.name,
                role: currentUser.role,
              }}
            />
          ) : (
            <>
              <Link href="/login" className={styles.loginButton} data-magnetic>
                Увійти
              </Link>

              <Link
                href="/register"
                className={styles.registerButton}
                data-magnetic
              >
                <span>Реєстрація</span>
                <span className="material-symbols-rounded">arrow_forward</span>
              </Link>
            </>
          )}
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroContent} data-reveal>
          <div className={styles.heroBadge}>
            <span className="material-symbols-rounded">auto_awesome</span>
            CRM для рекламної агенції
          </div>

          <h1 className={styles.heroTitle}>
            Керуйте клієнтами, кампаніями та оплатами в одному просторі
          </h1>

          <p className={styles.heroText}>
            AdFlow CRM — веб-інформаційна система для автоматизації роботи
            рекламної агенції: від першого брифу клієнта до запуску кампаній,
            задач команди, рахунків, оплат і статистики.
          </p>

          <div className={styles.heroActions}>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className={styles.primaryButton}
                data-magnetic
              >
                <span>Перейти до кабінету</span>
                <span className="material-symbols-rounded">arrow_forward</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={styles.primaryButton}
                  data-magnetic
                >
                  <span>Увійти до CRM</span>
                  <span className="material-symbols-rounded">login</span>
                </Link>

                <Link
                  href="/register"
                  className={styles.secondaryButton}
                  data-magnetic
                >
                  <span className="material-symbols-rounded">person_add</span>
                  <span>Створити акаунт</span>
                </Link>
              </>
            )}
          </div>

          <div className={styles.securityNote}>
            <span className="material-symbols-rounded">lock</span>
            <span>
              Доступ до панелі керування відкривається тільки після авторизації.
            </span>
          </div>

          <div className={styles.heroStats}>
            {heroStats.map((item) => (
              <div className={styles.heroStat} key={item.label} data-reveal>
                <span className={styles.heroStatIcon}>
                  <span className="material-symbols-rounded">{item.icon}</span>
                </span>

                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroVisual} data-reveal>
          <div className={styles.lottieFrame} data-parallax="1.2">
            <div className={styles.lottieOrbit} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div className={styles.lottieSlot}>
              <span className="material-symbols-rounded">animation</span>
              <strong>Lottie animation</strong>
              <p>Тут буде інтерактивна анімація CRM-процесу</p>
            </div>
          </div>

          <div className={styles.dashboardPreview} data-parallax="0.65">
            <div className={styles.previewHeader}>
              <div>
                <span>Панель агенції</span>
                <strong>Огляд активності</strong>
              </div>

              <span className={styles.liveBadge}>Онлайн</span>
            </div>

            <div className={styles.previewStats}>
              <div>
                <span className="material-symbols-rounded">trending_up</span>
                <strong>42</strong>
                <p>кампанії</p>
              </div>

              <div>
                <span className="material-symbols-rounded">payments</span>
                <strong>₴186K</strong>
                <p>оплати</p>
              </div>

              <div>
                <span className="material-symbols-rounded">task_alt</span>
                <strong>73</strong>
                <p>задачі</p>
              </div>
            </div>

            <div className={styles.progressCard}>
              <div>
                <span>Виконання задач</span>
                <strong>86%</strong>
              </div>

              <div className={styles.progressBar}>
                <span />
              </div>
            </div>

            <div className={styles.previewList}>
              {previewRows.map((row) => (
                <div className={styles.previewRow} key={row.title}>
                  <span className={styles.previewRowIcon}>
                    <span className="material-symbols-rounded">{row.icon}</span>
                  </span>

                  <div>
                    <strong>{row.title}</strong>
                    <p>{row.meta}</p>
                  </div>

                  <b>{row.value}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featuresSection} id="features">
        <div className={styles.sectionHeader} data-reveal>
          <span className={styles.sectionEyebrow}>Можливості</span>

          <h2>Не просто лендинг, а логічний інтерфейс CRM-системи</h2>

          <p>
            Головна сторінка працює як презентаційна частина продукту, а доступ
            до реальної CRM-панелі відбувається через вхід або реєстрацію.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article
              className={styles.featureCard}
              key={feature.title}
              data-reveal
            >
              <div className={styles.hugeIcon}>
                <span className="material-symbols-rounded">{feature.icon}</span>
              </div>

              <h3>{feature.title}</h3>
              <p>{feature.text}</p>

              <span className={styles.cardGlow} aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className={styles.workflowSection} id="workflow">
        <div className={styles.workflowPanel}>
          <div className={styles.sectionHeader} data-reveal>
            <span className={styles.sectionEyebrow}>Сценарій роботи</span>

            <h2>Від заявки клієнта до фінансового контролю</h2>

            <p>
              Структура системи відповідає предметній області рекламної агенції
              та демонструє реальні бізнес-процеси.
            </p>
          </div>

          <div className={styles.workflowGrid}>
            {workflow.map((item) => (
              <article
                className={styles.workflowCard}
                key={item.step}
                data-reveal
              >
                <span className={styles.workflowStep}>{item.step}</span>

                <div className={styles.workflowIcon}>
                  <span className="material-symbols-rounded">{item.icon}</span>
                </div>

                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.modulesSection} id="modules">
        <div className={styles.sectionHeader} data-reveal>
          <span className={styles.sectionEyebrow}>Модулі системи</span>

          <h2>Блочна структура під реальні таблиці бази даних</h2>

          <p>
            Кожен модуль інтерфейсу відповідає окремій сутності CRM та
            підключений до PostgreSQL через Prisma.
          </p>
        </div>

        <div className={styles.modulesGrid}>
          {modules.map((module) => (
            <div className={styles.moduleCard} key={module.entity} data-reveal>
              <span className={styles.moduleIcon}>
                <span className="material-symbols-rounded">{module.icon}</span>
              </span>

              <div>
                <strong>{module.label}</strong>
                <span>{module.entity}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.databaseSection} id="database">
        <div className={styles.databasePanel} data-reveal>
          <div className={styles.databaseContent}>
            <span className={styles.sectionEyebrow}>PostgreSQL-ready</span>

            <h2>Інтерфейс підключено до реальної бази даних</h2>

            <p>
              У проєкті використовується PostgreSQL: створені таблиці, зовнішні
              ключі, перевірки, унікальні обмеження та зв’язки між сутностями
              рекламної агенції.
            </p>

            <div className={styles.databaseTags}>
              {databaseHighlights.map((item) => (
                <span key={item}>
                  <span className="material-symbols-rounded">check_circle</span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.schemaPreview}>
            <div className={styles.schemaNodePrimary}>
              <span className="material-symbols-rounded">person</span>
              client
            </div>

            <div className={styles.schemaLine} />

            <div className={styles.schemaNode}>
              <span className="material-symbols-rounded">article</span>
              brief
            </div>

            <div className={styles.schemaLine} />

            <div className={styles.schemaNode}>
              <span className="material-symbols-rounded">folder_managed</span>
              project
            </div>

            <div className={styles.schemaBranches}>
              <div className={styles.schemaNodeSmall}>campaign</div>
              <div className={styles.schemaNodeSmall}>task</div>
              <div className={styles.schemaNodeSmall}>invoice</div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner} data-reveal>
          <div>
            <span className={styles.sectionEyebrow}>AdFlow CRM</span>

            <h2>CRM-панель готова до роботи</h2>

            <p>
              Авторизація, ролі, dashboard, PostgreSQL API, рахунки, оплати,
              задачі, кампанії та статистика вже зібрані в єдину систему.
            </p>
          </div>

          <div className={styles.finalActions}>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className={styles.primaryButton}
                data-magnetic
              >
                <span>Перейти до кабінету</span>
                <span className="material-symbols-rounded">login</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={styles.primaryButton}
                  data-magnetic
                >
                  <span>Увійти</span>
                  <span className="material-symbols-rounded">login</span>
                </Link>

                <Link
                  href="/register"
                  className={styles.secondaryButton}
                  data-magnetic
                >
                  <span className="material-symbols-rounded">person_add</span>
                  <span>Реєстрація</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <CookieBanner />
    </main>
  );
}