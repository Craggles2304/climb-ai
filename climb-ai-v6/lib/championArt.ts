const championIds:Record<string,string>={
  Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',
  "K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',
  LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw',
  'Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune',
  'Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol',
  'Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao',
};
export function championSplash(name:string){
  const id=championIds[name]||name.replace(/[^A-Za-z0-9]/g,'');
  return 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/'+id+'_0.jpg';
}