import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import LandingAnimations from "@/components/landing/LandingAnimations";
import { getCurrentUser } from "@/lib/auth";
import CookieBanner from "./CookieBanner";
import LandingUserActions from "./LandingUserActions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const LOTTIE_SRC =
  "https://lottie.host/8a00c6f8-b45f-4390-a145-603eb2f6c757/dEZUG9Z11i.lottie";

const marquee = [
  "Next.js 16",
  "React",
  "TypeScript",
  "Prisma ORM",
  "PostgreSQL",
  "CSS Modules",
  "App Router",
  "Server Actions",
  "6 ролей доступу",
];

const heroProof = [
  { value: "13", label: "сутностей БД" },
  { value: "10+", label: "CRM-модулів" },
  { value: "100%", label: "PostgreSQL" },
];

const techStack = [
  { name: "Next.js", icon: "/tech/nextjs.svg", note: "App Router та SSR" },
  { name: "React", icon: "/tech/react.svg", note: "Компонентний UI" },
  { name: "TypeScript", icon: "/tech/typescript.svg", note: "Сувора типізація" },
  { name: "PostgreSQL", icon: "/tech/postgresql.svg", note: "Реляційна база" },
  { name: "Prisma", icon: "/tech/prisma.svg", note: "ORM і міграції" },
  { name: "CSS Modules", icon: "/tech/css.svg", note: "Власний дизайн" },
];

const capabilities = [
  {
    icon: "groups",
    title: "Клієнтська база",
    text: "Клієнти, компанії, контакти та статуси співпраці в одному реєстрі.",
  },
  {
    icon: "assignment",
    title: "Брифи та проєкти",
    text: "Заявка перетворюється на проєкт із дедлайнами та відповідальними.",
  },
  {
    icon: "campaign",
    title: "Рекламні кампанії",
    text: "Канали, бюджети, дати запуску та статуси під повним контролем.",
  },
  {
    icon: "receipt_long",
    title: "Рахунки та оплати",
    text: "Фінансові операції, статуси оплат і контроль заборгованості.",
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
    text: "Вимоги, категорія послуг, бюджет і статус заявки фіксуються в системі.",
  },
  {
    step: "02",
    icon: "folder_open",
    title: "Менеджер створює проєкт",
    text: "Бриф стає проєктом із датами, задачами та відповідальними.",
  },
  {
    step: "03",
    icon: "campaign",
    title: "Запуск кампаній",
    text: "Для проєкту створюються кампанії, бюджет і збирається статистика.",
  },
  {
    step: "04",
    icon: "credit_score",
    title: "Рахунки й оплати",
    text: "CRM контролює фінансові операції та статуси оплат по проєктах.",
  },
];

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const isAuthenticated = Boolean(currentUser);

  return (
    <main className={styles.page}>
      <LandingAnimations />

      <Script
        src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.14/dist/dotlottie-wc.js"
        type="module"
        strategy="afterInteractive"
      />

      <div className={styles.backgroundAura} aria-hidden="true" />
      <div className={styles.backgroundGrid} aria-hidden="true" />

      <header className={styles.header}>
      <Link href="/" className={styles.logo} aria-label="AdFlow CRM">
  <Image
    src="/brand/logo.webp"
    alt="AdFlow CRM"
    width={160}
    height={40}
    priority
    className={styles.logoImg}
  />
</Link>

        <nav className={styles.nav}>
          <a href="#product">Продукт</a>
          <a href="#modules">Модулі</a>
          <a href="#stack">Технології</a>
          <a href="#workflow">Процес</a>
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
        <span className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroContent} data-reveal>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} aria-hidden="true" />
            CRM для рекламної агенції
          </div>

          <h1 className={styles.heroTitle}>
            Уся агенція в одному{" "}
            <span className={styles.heroTitleAccent}>робочому просторі</span>
          </h1>

          <p className={styles.heroText}>
            Від першого брифу клієнта до запуску кампаній, задач команди,
            рахунків, оплат і статистики — AdFlow CRM збирає всі процеси
            рекламної агенції в єдину систему з ролями та живими даними.
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

          <div className={styles.heroMarquee} data-marquee aria-hidden="true">
            <div className={styles.heroMarqueeTrack}>
              {[...marquee, ...marquee].map((item, index) => (
                <span key={`${item}-${index}`}>
                  <i className={styles.heroMarqueeStar} />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.heroProof}>
            {heroProof.map((item) => (
              <div className={styles.proofItem} key={item.label}>
                <strong className={styles.proofValue} data-count={item.value}>
                  {item.value}
                </strong>
                <span className={styles.proofLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroVisual} data-reveal>
          <div className={styles.heroStage} data-parallax="1.05">
            <svg
              className={styles.heroOrbit}
              viewBox="0 0 540 540"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="270"
                cy="270"
                r="258"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="2 12"
                strokeLinecap="round"
              />
              <circle
                cx="270"
                cy="270"
                r="196"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="1 16"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>

            <span className={styles.heroGlassRing} aria-hidden="true" />
            <span className={styles.heroLottieGlow} aria-hidden="true" />

            <div
              className={styles.heroLottie}
              dangerouslySetInnerHTML={{
                __html: `<dotlottie-wc src="${LOTTIE_SRC}" autoplay loop style="width:100%;height:100%"></dotlottie-wc>`,
              }}
            />

            <div
              className={`${styles.floatCard} ${styles.floatCardMetric}`}
              data-parallax="0.6"
            >
              <div className={styles.floatCardHead}>
                <span className={styles.floatCardIcon}>
                  <span className="material-symbols-rounded">payments</span>
                </span>
                <span className={styles.floatCardTrend}>
                  <span className="material-symbols-rounded">trending_up</span>
                  +18%
                </span>
              </div>

              <strong>₴186K</strong>
              <span>оплати за місяць</span>

              <svg
                className={styles.sparkline}
                viewBox="0 0 132 40"
                fill="none"
                aria-hidden="true"
              >
                <polyline
                  points="0,32 18,24 36,28 54,15 72,19 90,9 110,13 132,5"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div
              className={`${styles.floatCard} ${styles.floatCardRing}`}
              data-parallax="0.45"
            >
              <svg className={styles.ringSvg} viewBox="0 0 64 64" aria-hidden="true">
                <circle
                  className={styles.ringTrack}
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  strokeWidth="7"
                />
                <circle
                  className={styles.ringValue}
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray="163.36"
                  strokeDashoffset="22.87"
                  transform="rotate(-90 32 32)"
                />
              </svg>

              <div>
                <strong>86%</strong>
                <span>задач виконано</span>
              </div>
            </div>

            <div
              className={`${styles.floatCard} ${styles.floatToast}`}
              data-parallax="0.7"
            >
              <span className={styles.toastIcon}>
                <span className="material-symbols-rounded">campaign</span>
              </span>
              <div>
                <strong>Кампанію запущено</strong>
                <span>Google Ads · Nova Media</span>
              </div>
              <span className={styles.toastPing} aria-hidden="true" />
            </div>
          </div>

          <a href="#product" className={styles.scrollCue} aria-label="Прокрутити вниз">
            <span className="material-symbols-rounded">expand_more</span>
          </a>
        </div>
      </section>

      <section className={styles.showcase} id="product">
        <div className={styles.sectionHeader} data-reveal>
          <span className={styles.sectionEyebrow}>Продукт</span>
          <h2>Не презентація, а справжній інтерфейс системи</h2>
          <p>
            Реальна панель керування з ролями, фільтрами та живими даними з
            PostgreSQL. Кожна плитка нижче — окремий робочий процес агенції.
          </p>
        </div>

        <div className={styles.bento}>
          <article
            className={`${styles.bentoTile} ${styles.bentoPreview}`}
            data-reveal
            data-parallax="0.4"
          >
            <div className={styles.previewBar}>
              <span className={styles.previewDot} />
              <span className={styles.previewDot} />
              <span className={styles.previewDot} />
              <span className={styles.previewUrl}>adflow.crm/dashboard</span>
              <span className={styles.previewLive}>
                <span className={styles.previewLiveDot} aria-hidden="true" />
                Онлайн
              </span>
            </div>

            <div className={styles.previewShotWrap}>
              <Image
                src="/preview/preview.png"
                alt="Панель керування AdFlow CRM"
                width={1600}
                height={900}
                className={styles.previewShot}
              />
              <span className={styles.previewSheen} aria-hidden="true" />
            </div>
          </article>

          {capabilities.map((item) => (
            <article className={styles.bentoTile} key={item.title} data-reveal>
              <div className={styles.bentoIcon}>
                <span className="material-symbols-rounded">{item.icon}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span className={styles.bentoGlow} aria-hidden="true" />
            </article>
          ))}

          <article
            className={`${styles.bentoTile} ${styles.bentoChartTile}`}
            data-reveal
          >
            <div className={styles.bentoTileHead}>
              <h3>Динаміка оплат</h3>
              <span className={styles.bentoBadge}>6 міс.</span>
            </div>

            <div className={styles.bentoChart} aria-hidden="true">
              <span style={{ height: "42%" }} />
              <span style={{ height: "63%" }} />
              <span style={{ height: "37%" }} />
              <span style={{ height: "78%" }} />
              <span style={{ height: "55%" }} />
              <span style={{ height: "96%" }} />
            </div>

            <span className={styles.bentoGlow} aria-hidden="true" />
          </article>
        </div>

        <div className={styles.modulesHead} id="modules" data-reveal>
          <span className={styles.sectionEyebrow}>Карта сутностей</span>
          <h3>12 модулів — рівно під таблиці бази даних</h3>
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

      <section className={styles.closing} id="stack">
        <div className={styles.closingPanel} data-reveal>
          <span className={styles.closingAura} aria-hidden="true" />

          <div className={styles.closingTop}>
            <div className={styles.closingIntro}>
              <span className={styles.sectionEyebrow}>Стек і архітектура</span>
              <h2>Зібрано на сучасному продакшн-стеку</h2>
             <p>
            {"Типобезпечний фронтенд, серверні маршрути та реляційна база з міграціями — реальні зв'язки між сутностями агенції."}
          </p>

              <div className={styles.techGrid}>
                {techStack.map((tech) => (
                  <div className={styles.techCard} key={tech.name} data-magnetic>
                    <span className={styles.techIcon}>
                      <Image
                        src={tech.icon}
                        alt={tech.name}
                        width={38}
                        height={38}
                      />
                    </span>
                    <div>
                      <strong>{tech.name}</strong>
                      <span>{tech.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.schemaCard}>
           <span className={styles.schemaCaption}>{"Зв'язки сутностей"}</span>

              <div className={styles.schemaNodePrimary}>
                <span className="material-symbols-rounded">person</span>
                client
              </div>

              <span className={styles.schemaLine} />

              <div className={styles.schemaNode}>
                <span className="material-symbols-rounded">article</span>
                brief
              </div>

              <span className={styles.schemaLine} />

              <div className={styles.schemaNode}>
                <span className="material-symbols-rounded">folder_managed</span>
                project
              </div>

              <div className={styles.schemaBranches}>
                <span className={styles.schemaNodeSmall}>campaign</span>
                <span className={styles.schemaNodeSmall}>task</span>
                <span className={styles.schemaNodeSmall}>invoice</span>
              </div>
            </div>
          </div>

          <div className={styles.workflow} id="workflow">
            {workflow.map((item, index) => (
              <article className={styles.workflowStepCard} key={item.step} data-reveal>
                <span className={styles.workflowStepNo}>{item.step}</span>

                <div className={styles.workflowStepIcon}>
                  <span className="material-symbols-rounded">{item.icon}</span>
                </div>

                <strong>{item.title}</strong>
                <p>{item.text}</p>

                {index < workflow.length - 1 && (
                  <span className={styles.workflowDash} aria-hidden="true" />
                )}
              </article>
            ))}
          </div>

          <div className={styles.closingCta}>
            <div>
              <h3>CRM-панель готова до роботи</h3>
              <p>Авторизація, ролі, API, фінанси, задачі та статистика — в одній системі.</p>
            </div>

            <div className={styles.finalActions}>
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
                    href="/register"
                    className={styles.primaryButton}
                    data-magnetic
                  >
                    <span>Створити акаунт</span>
                    <span className="material-symbols-rounded">person_add</span>
                  </Link>

                  <Link
                    href="/login"
                    className={styles.secondaryButton}
                    data-magnetic
                  >
                    <span className="material-symbols-rounded">login</span>
                    <span>Увійти</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <CookieBanner />
    </main>
  );
}