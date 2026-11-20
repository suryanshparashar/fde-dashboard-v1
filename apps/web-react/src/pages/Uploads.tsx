import { Link, useNavigate } from 'react-router-dom';
import { useSnapshots } from '../hooks/useData';
import { fetchSnapshotText } from '../lib/api';
import { downloadText } from '../lib/csv';
import { dataMonth, fmtDate, fmtDateTime } from '../lib/format';
import { Breadcrumb } from '../components/fde';

export default function Uploads() {
  const navigate = useNavigate();
  const snapshots = useSnapshots();
  const list = snapshots.data ?? [];

  return (
    <>
      <Breadcrumb parts={[{ label: 'Overall', to: '/' }, { label: 'Uploads' }]} />
      <div className="page stack">
        <div>
          <h1 className="title">Monthly uploads</h1>
          <div className="sub mt-1">
            Each upload is one month's data (the month it was uploaded), kept as its own file in <code>local-data/</code>. Open any month to see the dashboard as it
            was.
          </div>
        </div>

        <div className="panel overflow-hidden">
          {snapshots.isLoading ? (
            <div className="p-8 text-muted">Loading…</div>
          ) : !list.length ? (
            <div className="empty big m-5">
              <b>No uploads yet.</b>
              <Link className="link" to="/upload">
                Upload this month's sheet →
              </Link>
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Data month</th>
                  <th>Uploaded</th>
                  <th>Latest completion in file</th>
                  <th>File</th>
                  <th className="text-right">Size</th>
                  <th style={{ width: 330 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <b>{dataMonth(s.id)}</b> {i === 0 && <span className="pill i ml-1">Latest</span>}
                    </td>
                    <td>{fmtDateTime(s.uploadedAt)}</td>
                    <td>{fmtDate(s.dataUpTo)}</td>
                    <td className="text-muted font-mono text-[12.5px]">{s.id}.csv</td>
                    <td className="text-right muted">{(s.sizeBytes / 1024).toFixed(0)} KB</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn sm primary" onClick={() => navigate(i === 0 ? '/' : `/?snapshot=${s.id}`)}>
                          View this data
                        </button>
                        <button className="btn sm ghost" onClick={() => navigate(`/uploads/${s.id}`)}>
                          Summary
                        </button>
                        <button className="btn sm ghost" onClick={async () => downloadText(`${s.id}.csv`, await fetchSnapshotText(s.id))} aria-label={`Download ${s.id}.csv`}>
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
