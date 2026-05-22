const ActivityIndicator = ({
  color = '#0A84FF',
  active = true,
  durationsec = 1.2,
  ...rest
})=>{
  
  return(
    <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}} {...rest}>
        <style>
            {`.lds-ring {
  display: inline-block;
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}
.lds-ring div {
  display: block;
  position: absolute;
  width: 100%;
  height: 100%;
  margin: 0%;
  border: 1px solid ${color};
  border-radius: 50%;
  animation: lds-ring ${durationsec}s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  border-color: ${color} transparent transparent transparent;
  opacity: ${ active ? 1 : 0  };
}
.lds-ring > * {
  transition: opacity 1s ease-in-out;
}
.lds-ring div:nth-child(1) {
  animation-delay: ${durationsec * -0.37}s;
}
.lds-ring div:nth-child(2) {
  animation-delay: ${durationsec * -0.25}s;
}
.lds-ring div:nth-child(3) {
  animation-delay: ${durationsec * -0.12}s;
}
.lds-ring span {  
  display: block;
  position: absolute;
  width: 100%;
  height: 100%;
  margin: 0%;
  border: 1px solid ${color};
  border-radius: 50%;
  opacity: ${ active ? 0 : 1  };
}
@keyframes lds-ring {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
`}
        </style>
        <div className="lds-ring"><div></div><div></div><div></div><div></div><span></span></div>
    </div>
  );
};

export default ActivityIndicator;