import Link from "next/link";
import styles from "./research.module.css";

export const metadata = { title: "官方歷年調查" };

type Difficulty = "普通" | "困難" | null;
interface SurveyRole {
  name: string;
  skills: string;
  values: [Difficulty, Difficulty, Difficulty];
}

const survey: SurveyRole[] = [
  { name: "AI 應用工程師", skills: "軟硬體整合、軟體工程、演算法測試", values: ["困難", "困難", "普通"] },
  { name: "專業領域應用工程師", skills: "系統整合、軟體工程、產業知識", values: ["普通", "普通", "困難"] },
  { name: "資料工程師", skills: "資料庫管理、數據推論、視覺化", values: ["普通", "普通", "困難"] },
  { name: "AI 與資料科學家", skills: "演算法驗證、數據推論、機器學習", values: ["困難", "困難", "困難"] },
  { name: "AI 專案經理", skills: "專案管理、產業應用知識", values: ["普通", "困難", "困難"] },
  { name: "AI 顧問", skills: "軟體工程、機器學習、演算法驗證", values: [null, "困難", "困難"] },
];

export default function ResearchPage() {
  return <main className={styles.page}>
    <Link href="/" className={styles.back}>← 職缺總覽</Link>
    <header><p className={styles.kicker}>官方歷年調查</p><h1>哪些 AI 職位較難招人？</h1>
    <p>資訊服務業人才調查記錄了企業的招募經驗。沿著同一列比較三年，可以看到不同職位的變化方向。</p></header>
    <section aria-labelledby="survey-title" className={styles.panel}>
      <h2 id="survey-title">各職位的招募難易度</h2>
      <p className={styles.period}>台灣資訊服務業 · 2022 至 2024 年</p>
      <div className={styles.scroll}><table><thead><tr><th scope="col">職位</th>{[2022,2023,2024].map(year=><th key={year} scope="col">{year}</th>)}</tr></thead>
        <tbody>{survey.map(role=><tr key={role.name}><th scope="row">{role.name}<small>{role.skills}</small></th>
          {role.values.map((value,i)=><td key={i} className={value === "困難" ? styles.hard : value === "普通" ? styles.normal : styles.none}>{value ?? "無資料"}</td>)}</tr>)}</tbody>
      </table></div>
      <footer>資料取自立法院彙整的國發會人才需求調查表 3。評級表示該年度調查的招募難易度。<br/>
      <a href="https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=56141&pid=256261" target="_blank" rel="noreferrer">查閱調查原表 ↗</a></footer>
    </section>
  </main>;
}
