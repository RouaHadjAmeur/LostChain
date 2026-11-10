import {Link} from 'react-router-dom';
import {UserRound} from 'lucide-react';
export default function MemberRequired(){return <div className="empty-state"><UserRound size={36}/><h3>Your campus workspace awaits.</h3><p>Sign in to access your reports, claims and profile.</p><Link to="/login" className="button primary">Sign in</Link><Link to="/register" className="button secondary">Register</Link></div>}
