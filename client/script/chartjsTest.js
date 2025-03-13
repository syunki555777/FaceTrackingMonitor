var ctx = document.getElementById( "myChart").getContext("2d");
var chart = new Chart(ctx, {
    type: "line",
    data: {
        datasets:[{
            label:"値",
            data:[{
                x: Date.now(),
                y: Math.random()
            },{
                x: Date.now(),
                y: Math.random()
            }]
        }]
    },
    options:{
        scales:{
            x:{
                type: "realtime",
                realtime:{
                    duration: 10000,
                    delay: 300,
                    refresh: 100,
                    frameRate: 30,
                    onRefresh: function(chart){
                        chart.data.datasets[0].data.push({
                            x: Date.now(),
                            y: Math.random()
                        });
                    }
                }
            }
        }
    }
});
