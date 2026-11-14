import styles from "./features.module.css";

const modes = [
  { name: "Aprender", emoji: "1f4da", detail: "De a 5 preguntas", description: "Sesiones cortas que se adaptan a tus respuestas para trabajar lo que necesitas." },
  { name: "Ensayos", emoji: "1f3c6", detail: "Las 65 preguntas", description: "Practica con un ensayo completo de M1, de principio a fin." },
  { name: "Playground", emoji: "1f3ae", detail: "Tú eliges", description: "Practica con las preguntas que tú elijas y resuélvelas a tu ritmo." },
];

const advantages = [
  { emoji: "1f3af", title: "Una ruta que se ajusta a ti.", description: "Parte con un diagnóstico de M1 y sigue con sesiones que combinan repaso y refuerzo según tus respuestas." },
  { emoji: "1f4ca", title: "Tu avance, eje por eje.", description: "Conoce cómo vas en los cuatro ejes de M1, con una estimación de dominio que se construye a medida que respondes." },
];

export function LandingFeatures() {
  return <section className={styles.features} aria-labelledby="practice-title">
    <div className={styles.heading}>
      <h2 id="practice-title">Elige cómo practicar hoy.</h2>
      <p>Una sesión breve, un ensayo completo o práctica a tu manera.</p>
    </div>
    <div className={styles.modes}>
      {modes.map(mode => <article key={mode.name} className={styles.mode}>
        <img src={`/emoji-apple/${mode.emoji}.png`} alt="" width="64" height="64" loading="lazy" />
        <h3>{mode.name}</h3>
        <span className={styles.detail}>{mode.detail}</span>
        <p>{mode.description}</p>
      </article>)}
    </div>
    <div className={styles.morePractice}>
      <section className={styles.importFeature} aria-labelledby="import-title">
        <img className={styles.importEmoji} src="/emoji-apple/1f4da.png" alt="" width="56" height="56" loading="lazy" />
        <h2 id="import-title">Tus ensayos también <span>tienen lugar aquí.</span></h2>
        <p>Importa ensayos compatibles en formato <strong>.paessed</strong>, <strong>.zip</strong> o <strong>.json</strong> y resuelve sus preguntas en Paessed.</p>
        <p className={styles.importNote}>Se guardan en la biblioteca de este navegador. También puedes elegir sus preguntas en Playground.</p>
        <p className={styles.compatibility}>Los ZIP deben incluir un archivo <strong>final.json</strong> con las preguntas.</p>
      </section>
      <div className={styles.advantages}>
        {advantages.map(({ emoji, title, description }) => <article key={title} className={styles.advantage}>
          <img src={`/emoji-apple/${emoji}.png`} alt="" width="40" height="40" loading="lazy" />
          <div><h3>{title}</h3><p>{description}</p></div>
        </article>)}
      </div>
    </div>
  </section>;
}
