import { useState } from "react";

export async function getServerSideProps({ req }) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["host"] || `localhost:${process.env.PORT || 3000}`;
    const res = await fetch(`${proto}://${host}/health`);
    const data = await res.json();
    return { props: { initialStatus: data } };
  } catch (err) {
    return {
      props: {
        initialStatus: null,
        initialError: err.message || "No se pudo conectar",
      },
    };
  }
}

export default function StatusPage({ initialStatus, initialError }) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState(initialError);

  const refresh = async () => {
    try {
      const res = await fetch("/health");
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}> OmniRoute Port Bridge</h1>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Estado del puente</h2>
          <div style={styles.row}>
            <span style={styles.label}>Estado</span>
            <Badge ok>Activo</Badge>
          </div>
          {status?.bridge && (
            <>
              <div style={styles.row}>
                <span style={styles.label}>Host</span>
                <span style={styles.mono}>{status.bridge.host}</span>
              </div>
              <div style={styles.row}>
                <span style={styles.label}>Puerto</span>
                <span style={styles.mono}>{status.bridge.port}</span>
              </div>
            </>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>OmniRoute</h2>
          {error ? (
            <p style={styles.error}>Error: {error}</p>
          ) : !status ? (
            <p style={styles.loading}>Cargando...</p>
          ) : (
            <>
              <div style={styles.row}>
                <span style={styles.label}>Instalado</span>
                <Badge ok={status.omniroute.installed}>
                  {status.omniroute.installed ? "Sí" : "No"}
                </Badge>
              </div>
              <div style={styles.row}>
                <span style={styles.label}>Corriendo</span>
                <Badge ok={status.omniroute.running}>
                  {status.omniroute.running ? "Sí" : "No"}
                </Badge>
              </div>
              <div style={styles.row}>
                <span style={styles.label}>URL destino</span>
                <span style={styles.mono}>{status.omniroute.url}</span>
              </div>
              {status.omniroute.startedByUs && (
                <div style={styles.row}>
                  <span style={styles.label}>Iniciado por</span>
                  <Badge warn>Bridge</Badge>
                </div>
              )}
            </>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Enlaces útiles</h2>
          <div style={styles.links}>
            <a
              href="/dashboard"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
               Dashboard
            </a>
            <a
              href="/v1/models"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              🤖 Modelos
            </a>
            <a
              href="/health"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              ️ Health JSON
            </a>
          </div>
        </div>

        {status && !status.omniroute.installed && (
          <div style={{ ...styles.card, borderColor: "#7f1d1d" }}>
            <h2 style={styles.cardTitle}>❌ OmniRoute no instalado</h2>
            <p style={styles.help}>
              OmniRoute no está instalado. Instálalo con:
            </p>
            <pre style={styles.code}>npm install -g omniroute</pre>
          </div>
        )}

        {status && status.omniroute.installed && !status.omniroute.running && (
          <div style={{ ...styles.card, borderColor: "#854d0e" }}>
            <h2 style={styles.cardTitle}>⚠️ OmniRoute no está corriendo</h2>
            <p style={styles.help}>
              Está instalado pero no responde. El bridge debería haberlo
              iniciado automáticamente; si no, ejecútalo manualmente:
            </p>
            <pre style={styles.code}>omniroute</pre>
          </div>
        )}

        <button onClick={refresh} style={styles.button}>
          🔄 Actualizar estado
        </button>
      </div>
    </div>
  );
}

function Badge({ children, ok, warn }) {
  const style = {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "99px",
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: ok ? "#166534" : warn ? "#854d0e" : "#7f1d1d",
    color: ok ? "#86efac" : warn ? "#fde047" : "#fca5a5",
  };
  return <span style={style}>{children}</span>;
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e2e8f0",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  container: {
    maxWidth: "680px",
    width: "100%",
  },
  title: {
    fontSize: "1.5rem",
    marginBottom: "24px",
    color: "#38bdf8",
  },
  card: {
    background: "#1e293b",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
    border: "1px solid #334155",
  },
  cardTitle: {
    fontSize: "1rem",
    color: "#94a3b8",
    marginBottom: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #334155",
  },
  label: {
    color: "#94a3b8",
    fontSize: "0.9rem",
  },
  mono: {
    fontFamily: "monospace",
    fontSize: "0.85rem",
  },
  links: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  link: {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: "8px",
    background: "#334155",
    color: "#e2e8f0",
    textDecoration: "none",
    fontSize: "0.85rem",
    transition: "background 0.2s",
  },
  button: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: 600,
    marginTop: "8px",
  },
  loading: {
    color: "#94a3b8",
  },
  error: {
    color: "#fca5a5",
  },
  help: {
    color: "#94a3b8",
    fontSize: "0.9rem",
    lineHeight: 1.5,
  },
  code: {
    background: "#0f172a",
    padding: "12px",
    borderRadius: "8px",
    marginTop: "12px",
    fontSize: "0.85rem",
    overflowX: "auto",
  },
};
