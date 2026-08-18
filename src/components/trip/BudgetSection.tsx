import { defaultBudget } from '../../state';
import type { Mutate, TripState } from '../../types';

export default function BudgetSection({
  state,
  editUnlocked,
  mutate,
  currency,
}: {
  state: TripState;
  editUnlocked: boolean;
  mutate: Mutate;
  currency: string;
}) {
  const sum = state.budget.reduce((a, x) => a + (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0), 0);

  return (
    <section className="section">
      <div className="section-head">
        <h2>💰 预算</h2>
        <span className="muted">
          {currency || 'MYR'} · 估算总额 {sum.toLocaleString()}
        </span>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table className="budget-table">
          <thead>
            <tr>
              <th>分类</th>
              <th>数量</th>
              <th>单价</th>
              <th>小计</th>
              <th>备注</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.budget.map((x, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="editable"
                    value={x.category}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].category = e.target.value;
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="editable"
                    type="number"
                    value={x.quantity}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].quantity = e.target.value;
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="editable"
                    type="number"
                    value={x.unitPrice}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].unitPrice = e.target.value;
                      })
                    }
                  />
                </td>
                <td>{((Number(x.quantity) || 0) * (Number(x.unitPrice) || 0)).toLocaleString()}</td>
                <td>
                  <input
                    className="editable"
                    value={x.note}
                    onChange={(e) =>
                      mutate((d) => {
                        d.budget[i].note = e.target.value;
                      })
                    }
                  />
                </td>
                <td>
                  {editUnlocked && (
                    <button
                      className="mini edit-only"
                      onClick={() =>
                        mutate((d) => {
                          d.budget.splice(i, 1);
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editUnlocked && (
        <button
          className="add-btn edit-only"
          onClick={() =>
            mutate((d) => {
              d.budget.push(defaultBudget());
            })
          }
        >
          ＋ 添加预算项目
        </button>
      )}
    </section>
  );
}
