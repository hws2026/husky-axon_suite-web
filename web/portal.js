async function verify(){
 try{
  const res=await fetch('/api/me');if(res.status===401){location.replace('/');return}if(!res.ok)throw new Error();
  const user=await res.json();document.querySelector('#welcome').textContent='Welcome, '+user.name;
  document.querySelector('#status').textContent=user.overallAdmin?'Overall admin access':'Agency access verified';
  const list=document.createElement('ul');for(const agency of user.agencies){const item=document.createElement('li');item.textContent=agency.name+' · '+agency.role;list.append(item)}
  document.querySelector('#agencies').replaceChildren(list);document.querySelector('#owner').hidden=!user.overallAdmin;
 }catch{document.querySelector('#status').textContent='Unable to verify Discord access. Camera access remains unavailable.'}
}
document.querySelector('#logout').onclick=async()=>{const res=await fetch('/auth/logout',{method:'POST'});if(res.ok)location.replace('/')};
verify();setInterval(verify,60000);
