import React, { useState, useEffect } from 'react';
import './App.css'; 

// --- CONFIGURACIÓN ---
const API_BASE: string = "http://localhost:8000";

// --- TIPOS (Alineados con el Backend) ---
type FutureMatch = {
    date: string;
    league: string;
    home_team: string;
    away_team: string;
    home_win_prob: number;
    draw_prob: number;
    away_win_prob: number;
    best_pick_label: string;
};
type ApiLeagues = { leagues: string[] };

type PredictResponse = {
    league: string;
    home_team: string;
    away_team: string;
    probs: { [key: string]: number };
    poisson: { [key: string]: any };
    averages: { [key: string]: number };
    total_goals_proj: number;
    best_pick: { [key: string]: any };
    summary: string;
};

type EvaluationResponse = {
    evaluation_model: string;
    error_abs: number;
    precision_rating: string;
    conclusion: string;
    real_spread_abs: number;
    ats_covered: boolean;
    direction_correct: boolean;
};


// --- HELPERS Y ESTILOS DE CARTA ---
const fetchJSON = async <T,>(url: string, opts: RequestInit = {}): Promise<T> => {
    const res = await fetch(url, opts);
    if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.detail || `HTTP ${res.status}`);
    }
    return res.json() as T;
};
const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    // Agregamos el formato de hora para que se vea más profesional (ej: 09:00 p.m.)
    const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + time.replace(' ', '');
};
const inputStyle: React.CSSProperties = { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' };

// Estilos base de componentes
const pill: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999,
    background: "#f0f0f0", border: "1px solid #ccc", color: "#333", fontSize: 12, whiteSpace: "nowrap",
};
const labelCss: React.CSSProperties = { color: '#7c3aed', fontSize: 12, marginBottom: 4, fontWeight: 'bold' };

const CustomStyles = () => (
    <style>{`
        body { background-color: #f0f0f0; }
        .match-card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 15px;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s;
        }
        .match-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }
        .hot-label { position: absolute; top: 0px; right: 0px; background-color: #ff4b4b; color: white; padding: 5px 15px; border-bottom-left-radius: 8px; font-weight: bold; font-size: 0.8em; transform: rotate(45deg) translate(20%, -10%); transform-origin: 100% 0%; z-index: 10; width: 80px; text-align: center; }
        .match-header { text-align: center; font-size: 0.9em; color: #666; margin-bottom: 10px; }
        .teams-name { font-size: 1.5em; font-weight: bold; text-align: center; margin-bottom: 15px; }
        .main-pick-box { background-color: #e6f7ff; border: 1px solid #b3e0ff; padding: 10px; border-radius: 5px; margin-bottom: 10px; }
        .cuota { font-size: 1.8em; font-weight: 900; color: #007bff; display: block; text-align: right; }
        .apuesta-btn { background-color: #ff9900; color: white; padding: 10px 15px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px; }
        
        .modal-pick {
            background-color: #e6f7ff;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .modal-proj {
            text-align: center;
            margin-top: 15px;
        }
        .modal-lambda-box {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 8px;
        }
    `}</style>
);


// ====================================================================
// COMPONENTE MODAL DE DETALLES DEL PARTIDO (FULL PREDICTION)
// ====================================================================

function MatchDetailModal({ match, onClose, detailData, loading }) {
    if (!match) return null;

    const data: PredictResponse | null = detailData;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
            <div style={{ background: '#fff', width: 'min(900px, 95vw)', maxHeight: '90vh', overflowY: 'auto', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', padding: '30px' }}>
                
                {/* Cabecera del Modal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #007bff', paddingBottom: '15px', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: '#007bff', fontSize: '1.8em' }}>Modelo de Predicción y Evaluación</h2>
                    <button onClick={onClose} style={{ background: '#ef4444', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Cerrar ✕</button>
                </div>

                {/* Título del Partido */}
                <h3 style={{ margin: '0 0 20px 0', color: '#333', textAlign: 'center' }}>
                    {match.home_team} vs {match.away_team} ({match.league}, {formatDate(match.date)})
                </h3>
                
                {loading && <p style={{ textAlign: 'center' }}>Cargando datos detallados del modelo...</p>}

                {data && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                        
                        {/* COLUMNA IZQUIERDA: Pick, Proyección y 1X2 */}
                        <div style={{ borderRight: '1px solid #eee', paddingRight: '30px' }}>
                            
                            {/* Pick del Modelo (Goles) */}
                            <div className="modal-pick">
                                <div style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: '0.9em' }}>Pick del modelo (Goles)</div>
                                <strong style={{ fontSize: '2em', color: '#007bff' }}>Over 2.5 Goles</strong> 
                            </div>

                            {/* Proyección Goles Totales */}
                            <div className="modal-proj">
                                <div style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: '0.9em' }}>Proyección del modelo (Goles Totales)</div>
                                <strong style={{ fontSize: '2.5em', color: '#7c3aed' }}>{data.total_goals_proj.toFixed(2)} goles</strong>
                            </div>
                            
                            <h4 style={{ color: '#333', marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '15px' }}>Probabilidades Desglosadas (1X2 - Random Forest)</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1em' }}>
                                <tbody>
                                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>Local ({match.home_team})</td><td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{data.probs.home_win_pct.toFixed(2)}%</td></tr>
                                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>Empate (X)</td><td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{data.probs.draw_pct.toFixed(2)}%</td></tr>
                                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>Visitante ({match.away_team})</td><td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{data.probs.away_win_pct.toFixed(2)}%</td></tr>
                                </tbody>
                            </table>
                        </div>

                        {/* COLUMNA DERECHA: Poisson y Detalles Secundarios */}
                        <div>
                            <h4 style={{ color: '#333' }}>Detalles del Modelo (Poisson/Averages)</h4>
                            
                            <div className="modal-lambda-box">
                                <div style={{ color: '#7c3aed', fontWeight: 'bold', fontSize: '0.9em', marginBottom: '10px' }}>LAMBDA GOLES ESPERADOS (Poisson)</div>
                                <p>Local (λ): <strong style={{ color: '#007bff', float: 'right' }}>{data.poisson.home_lambda.toFixed(2)}</strong></p>
                                <p>Visitante (λ): <strong style={{ color: '#007bff', float: 'right' }}>{data.poisson.away_lambda.toFixed(2)}</strong></p>
                            </div>

                            <div style={{ marginTop: '20px' }}>
                                <h5 style={{ color: '#333' }}>Proyecciones Secundarias</h5>
                                <p style={{ fontSize: '0.9em' }}>
                                    Corners: <strong style={{ float: 'right' }}>{data.averages.corners_mlp_pred.toFixed(2)}</strong>
                                    <br/>
                                    Tarjetas: <strong style={{ float: 'right' }}>{data.averages.total_yellow_cards_avg.toFixed(2)}</strong>
                                </p>
                            </div>
                            
                            <h4 style={{ color: '#333', marginTop: '20px' }}>Otros Mercados (Calculado por Poisson)</h4>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1em' }}>
                                <tbody>
                                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>Over 2.5 Goles</td><td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{data.probs.over_2_5_pct.toFixed(2)}%</td></tr>
                                    <tr><td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>BTTS (Sí)</td><td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{data.probs.btts_pct.toFixed(2)}%</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ====================================================================
// COMPONENTE APP PRINCIPAL
// ====================================================================

export default function App() {
    const [leagues, setLeagues] = useState<string[]>([]);
    const [selectedLeague, setSelectedLeague] = useState(""); 
    
    const [futureMatches, setFutureMatches] = useState<FutureMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    // ESTADO PARA MODAL DE DETALLES
    const [modalMatch, setModalMatch] = useState<FutureMatch | null>(null);
    const [modalDetails, setModalDetails] = useState<PredictResponse | null>(null);
    const [modalLoading, setModalLoading] = useState(false);

    // ESTADO PARA EVALUACIÓN
    const [evalState, setEvalState] = useState({ pick_model_spread: '2.9', book_line: '-9', real_spread: '3.0' });
    const [evalLoading, setEvalLoading] = useState(false);
    const [evalResult, setEvalResult] = useState<EvaluationResponse | null>(null);


    // Cargar ligas y partidos futuros al iniciar/cambiar liga
    useEffect(() => {
        // Cargar todas las ligas disponibles
        fetchJSON<ApiLeagues>(`${API_BASE}/leagues`)
            .then(d => setLeagues(d.leagues ?? []))
            .catch(e => setError("Error al cargar ligas: Backend no responde."));
            
        // Cargar partidos futuros (con filtro)
        const leagueFilter = selectedLeague ? `&league=${encodeURIComponent(selectedLeague)}` : '';
        setLoading(true);
        fetchJSON<FutureMatch[]>(`${API_BASE}/future-matches?days=5${leagueFilter}`)
            .then(data => {
                setFutureMatches(data);
                setLoading(false);
            })
            .catch(e => {
                setError(`Error al cargar partidos futuros: ${e.message}.`);
                setLoading(false);
            });
    }, [selectedLeague]);


    // Función para abrir el modal y cargar los detalles
    async function openMatchDetails(match: FutureMatch) {
        setModalMatch(match);
        setModalDetails(null);
        setModalLoading(true);

        try {
            // Llama al endpoint /match-details que usa Random Forest y Poisson
            const data = await fetchJSON<PredictResponse>(
                `${API_BASE}/match-details?league=${encodeURIComponent(match.league)}&home_team=${encodeURIComponent(match.home_team)}&away_team=${encodeURIComponent(match.away_team)}`
            );
            setModalDetails(data);
        } catch (e) {
            alert("No se pudieron cargar los detalles del modelo. Asegúrese de que el Backend está activo.");
        } finally {
            setModalLoading(false);
        }
    }


    // Manejador de la Evaluación (usa el endpoint /evaluate)
    async function handleEvaluation() {
        const { pick_model_spread, book_line, real_spread } = evalState;
        const proj = parseFloat(pick_model_spread);
        const book = parseFloat(book_line);
        const real = parseFloat(real_spread);
        
        if (isNaN(proj) || isNaN(book) || isNaN(real)) {
            alert("Por favor, ingresa valores numéricos válidos en todos los campos de evaluación.");
            return;
        }

        setEvalLoading(true);
        try {
            const data = await fetchJSON<EvaluationResponse>(`${API_BASE}/evaluate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pick_model_spread: proj, book_line: book, real_spread: real })
            });
            setEvalResult(data);
        } catch (e: any) {
            alert(`Error en la evaluación: ${e.message}`);
        } finally {
            setEvalLoading(false);
        }
    }


    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: 'auto', fontFamily: 'sans-serif', color: '#333' }}>
            <CustomStyles />
            <h2 style={{ color: '#007bff', borderBottom: '3px solid #007bff', paddingBottom: '5px' }}>Pronósticos Fútbol</h2>
            
            {error && <div style={{ color: 'white', background: 'red', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>{error}</div>}

            {/* --- SECCIÓN DE EVALUACIÓN DE RENDIMIENTO --- */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                <h3 style={{ color: '#7c3aed', borderBottom: '2px solid #7c3aed', paddingBottom: '5px' }}>🎯 Evaluación de Rendimiento (Spread/ATS)</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginTop: '15px' }}>
                    
                    <div>
                        <label>Proyección Modelo (ej: 2.9)</label>
                        <input type="number" style={inputStyle} value={evalState.pick_model_spread} onChange={e => setEvalState({...evalState, pick_model_spread: e.target.value})} />
                    </div>
                    <div>
                        <label>Línea Book (ej: -9)</label>
                        <input type="number" style={inputStyle} value={evalState.book_line} onChange={e => setEvalState({...evalState, book_line: e.target.value})} />
                    </div>
                    <div>
                        <label>Resultado Real (Margen, ej: 3.0)</label>
                        <input type="number" style={inputStyle} value={evalState.real_spread} onChange={e => setEvalState({...evalState, real_spread: e.target.value})} />
                    </div>
                    <div style={{ paddingTop: '25px' }}>
                        <button onClick={handleEvaluation} disabled={evalLoading} style={{ background: '#7c3aed', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>
                            {evalLoading ? 'Evaluando...' : 'Evaluar Precisión'}
                        </button>
                    </div>
                </div>

                {evalResult && (
                    <div style={{ marginTop: '20px', padding: '15px', border: `2px solid ${evalResult.precision_rating.includes('Altísima') ? '#22c55e' : '#f59e0b'}`, borderRadius: '5px', background: '#f9f9f9', color: '#333' }}>
                        <h4 style={{ color: '#7c3aed', margin: 0 }}>📈 Conclusión de Rendimiento: {evalResult.precision_rating}</h4>
                        <p style={{ marginTop: '10px', marginBottom: '5px' }}>{evalResult.conclusion}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontWeight: 'bold', fontSize: '0.9em' }}>
                            <span>Error Absoluto: <span style={{ color: '#d97706' }}>{evalResult.error_abs.toFixed(2)}</span> puntos</span>
                            <span>ATS Cubierto: <span style={{ color: evalResult.ats_covered ? '#22c55e' : '#ef4444' }}>{evalResult.ats_covered ? '✅ SÍ' : '❌ NO'}</span></span>
                            <span>Dirección Correcta: <span style={{ color: evalResult.direction_correct ? '#22c55e' : '#ef4444' }}>{evalResult.direction_correct ? '✅ SÍ' : '❌ NO'}</span></span>
                        </div>
                    </div>
                )}
            </div>
            
            {/* --- FILTRO DE LIGAS Y DASHBOARD --- */}
            
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Listado de Pronósticos</h3>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Filtrar por Liga:</label>
                    <select 
                        onChange={e => setSelectedLeague(e.target.value)} 
                        value={selectedLeague}
                        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                        <option value="">-- Todas las Ligas --</option>
                        {leagues.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <div>
                    <p>Total: {futureMatches.length} partidos</p>
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Cargando partidos...</div>}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {futureMatches.map((match, index) => (
                    <div key={index} className="match-card">
                        <div className="hot-label">HOT🔥</div>
                        
                        <div className="match-header">
                            {formatDate(match.date)}
                            <br/>
                            {match.league}
                        </div>
                        
                        <h3 className="teams-name">{match.home_team} - {match.away_team}</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px', alignItems: 'center' }}>
                            <div className="main-pick-box">
                                Pronósticos {match.home_team} {match.away_team}
                                <br/>
                                <strong style={{ color: '#007bff', fontSize: '1.2em' }}>{match.best_pick_label.split('(')[0]}</strong>
                                <br/>
                                <small onClick={() => openMatchDetails(match)} style={{ color: '#007bff', cursor: 'pointer', fontWeight: 'bold' }}>En detalles &gt;</small>
                            </div>
                            <div>
                                <span className="cuota">{(1 / match.home_win_prob).toFixed(2)}</span> 
                            </div>
                        </div>

                        <button className="apuesta-btn">¡APUESTA AHORA!</button>
                    </div>
                ))}
            </div>

            {(!loading && futureMatches.length === 0 && !error) && <p style={{ textAlign: 'center', marginTop: '30px' }}>No se encontraron partidos programados en la liga seleccionada.</p>}

            {/* Renderizar el Modal */}
            <MatchDetailModal 
                match={modalMatch} 
                onClose={() => setModalMatch(null)} 
                detailData={modalDetails} 
                loading={modalLoading} 
            />
        </div>
    );
}