import { useEffect, useState } from 'react';
import '../styles/message.css';
import { MessageScreen } from '../types/mesage-screen';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import NoticeScreen from '../v2-partials/notice';
import { useParams } from 'react-router-dom';

export default function Message() {
  const [msgScreen, setMsgScreen] = useState<MessageScreen | null>(null);
  const token = useParams()["*"];

  useEffect(()=>{
    let msgScreen = {} as MessageScreen;

    console.log(token, 'tasdfasdfoken');

    try {
      const b64Msg = token;
      msgScreen = JSON.parse(atob(b64Msg || ""));
      console.log(msgScreen, 'msgScreen');
    } catch (error) {
      console.log(error, 'error');
      //window.location.href = "/";
    }

    setMsgScreen(msgScreen);
  }, []);

  if (!msgScreen){
    return (<></>)
  }

  return (<>
    <V2Header />
    <NoticeScreen notice={msgScreen} />
    <V2Footer />
  </>);
}
